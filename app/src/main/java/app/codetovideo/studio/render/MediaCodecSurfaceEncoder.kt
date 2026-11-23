package app.codetovideo.studio.render

import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaCodecList
import android.media.MediaFormat
import android.media.MediaMuxer
import android.opengl.EGL14
import android.opengl.EGLExt
import android.opengl.GLES20
import android.os.Build
import android.view.Surface
import java.io.FileDescriptor
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer
import kotlin.math.roundToInt

/** Hardware AVC encoder. One RGBA frame is uploaded and drained at a time. */
class MediaCodecSurfaceEncoder(
    outputFd: FileDescriptor,
    private val width: Int,
    private val height: Int,
    private val fps: Int,
    private val quality: String
) {
    private val codecInfo: MediaCodecInfo = chooseCodec(width, height, fps)
    private val codec: MediaCodec
    private val muxer: MediaMuxer
    private val inputSurface: Surface
    private val gl: EncoderEglRenderer
    private var trackIndex = -1
    private var muxerStarted = false
    private var released = false

    init {
        val caps = codecInfo.getCapabilitiesForType(MediaFormat.MIMETYPE_VIDEO_AVC).videoCapabilities
        val multiplier = when (quality) { "low" -> 0.65; "high" -> 1.5; "ultra" -> 2.0; else -> 1.0 }
        val wanted = (width.toLong() * height * fps * 0.08 * multiplier).roundToInt()
        val bitRate = wanted.coerceIn(caps.bitrateRange.lower, caps.bitrateRange.upper)
        val format = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, width, height).apply {
            setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface)
            setInteger(MediaFormat.KEY_BIT_RATE, bitRate)
            setInteger(MediaFormat.KEY_FRAME_RATE, fps)
            setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 2)
        }
        codec = MediaCodec.createByCodecName(codecInfo.name)
        codec.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
        inputSurface = codec.createInputSurface()
        muxer = MediaMuxer(outputFd, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
        codec.start()
        gl = EncoderEglRenderer(inputSurface, width, height)
    }

    fun writeFrame(frameIndex: Int, rgba: ByteArray) {
        check(!released) { "Encoder sudah ditutup." }
        require(rgba.size == width * height * 4) { "Ukuran frame RGBA tidak sesuai." }
        val ptsNs = frameIndex.toLong() * 1_000_000_000L / fps
        gl.draw(rgba, ptsNs)
        drainEncoder(waitForEnd = false)
    }

    fun finish() {
        if (released) return
        codec.signalEndOfInputStream()
        drainEncoder(waitForEnd = true)
        release()
    }

    fun release() {
        if (released) return
        released = true
        runCatching { gl.release() }
        runCatching { codec.stop() }
        runCatching { codec.release() }
        runCatching { inputSurface.release() }
        if (muxerStarted) runCatching { muxer.stop() }
        runCatching { muxer.release() }
    }

    private fun drainEncoder(waitForEnd: Boolean) {
        val info = MediaCodec.BufferInfo()
        var sawEos = false
        val startedAt = System.currentTimeMillis()
        while (!sawEos) {
            val outputIndex = codec.dequeueOutputBuffer(info, if (waitForEnd) 10_000L else 0L)
            when {
                outputIndex == MediaCodec.INFO_TRY_AGAIN_LATER -> {
                    if (!waitForEnd) return
                    if (System.currentTimeMillis() - startedAt > 30_000) {
                        throw IllegalStateException("Timeout saat menunggu encoder menyelesaikan MP4.")
                    }
                }
                outputIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
                    check(!muxerStarted) { "Format encoder berubah lebih dari sekali." }
                    trackIndex = muxer.addTrack(codec.outputFormat)
                    muxer.start()
                    muxerStarted = true
                }
                outputIndex >= 0 -> {
                    val output = codec.getOutputBuffer(outputIndex)
                        ?: throw IllegalStateException("Output buffer encoder tidak tersedia.")
                    if (info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG != 0) info.size = 0
                    if (info.size > 0) {
                        check(muxerStarted && trackIndex >= 0) { "Muxer belum siap menerima sample." }
                        output.position(info.offset)
                        output.limit(info.offset + info.size)
                        muxer.writeSampleData(trackIndex, output, info)
                    }
                    sawEos = info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0
                    codec.releaseOutputBuffer(outputIndex, false)
                    if (sawEos) break
                }
            }
        }
    }

    companion object {
        fun chooseCodec(width: Int, height: Int, fps: Int): MediaCodecInfo {
            val infos = MediaCodecList(MediaCodecList.REGULAR_CODECS).codecInfos
                .filter { it.isEncoder && it.supportedTypes.any { type -> type.equals(MediaFormat.MIMETYPE_VIDEO_AVC, true) } }
            val capable = infos.filter { info ->
                runCatching {
                    val vc = info.getCapabilitiesForType(MediaFormat.MIMETYPE_VIDEO_AVC).videoCapabilities
                    vc.areSizeAndRateSupported(width, height, fps.toDouble())
                }.getOrDefault(false)
            }
            val selected = capable.firstOrNull { Build.VERSION.SDK_INT >= 29 && it.isHardwareAccelerated }
                ?: capable.firstOrNull()
            return selected ?: throw IllegalStateException(
                "Perangkat tidak menemukan encoder H.264 untuk ${width}×${height} @ ${fps} FPS. Coba 480p/720p atau perangkat lain."
            )
        }
    }
}

/** GLES2 blitter into the MediaCodec input Surface; timestamps are nanoseconds. */
private class EncoderEglRenderer(private val inputSurface: Surface, private val width: Int, private val height: Int) {
    private val display = EGL14.eglGetDisplay(EGL14.EGL_DEFAULT_DISPLAY)
    private val config: android.opengl.EGLConfig
    private val context: android.opengl.EGLContext
    private val windowSurface: android.opengl.EGLSurface
    private val program: Int
    private val textureId: Int
    private val positionLocation: Int
    private val texCoordLocation: Int
    private val samplerLocation: Int
    private val positions: FloatBuffer = floatBuffer(floatArrayOf(-1f, -1f, 1f, -1f, -1f, 1f, 1f, 1f))
    private val pixelBuffer: ByteBuffer = ByteBuffer.allocateDirect(width * height * 4).order(ByteOrder.nativeOrder())
    private val texCoords: FloatBuffer = floatBuffer(floatArrayOf(0f, 1f, 1f, 1f, 0f, 0f, 1f, 0f))

    init {
        require(display != EGL14.EGL_NO_DISPLAY) { "EGL display tidak tersedia." }
        val versions = IntArray(2)
        check(EGL14.eglInitialize(display, versions, 0, versions, 1)) { "EGL initialize gagal." }
        val attribs = intArrayOf(
            EGL14.EGL_RED_SIZE, 8, EGL14.EGL_GREEN_SIZE, 8, EGL14.EGL_BLUE_SIZE, 8,
            EGL14.EGL_ALPHA_SIZE, 8, EGL14.EGL_RENDERABLE_TYPE, EGL14.EGL_OPENGL_ES2_BIT,
            0x3142, 1, // EGL_RECORDABLE_ANDROID
            EGL14.EGL_NONE
        )
        val configs = arrayOfNulls<android.opengl.EGLConfig>(1)
        val count = IntArray(1)
        check(EGL14.eglChooseConfig(display, attribs, 0, configs, 0, configs.size, count, 0) && count[0] > 0) {
            "EGL recordable config tidak ditemukan."
        }
        config = configs[0]!!
        context = EGL14.eglCreateContext(
            display, config, EGL14.EGL_NO_CONTEXT,
            intArrayOf(EGL14.EGL_CONTEXT_CLIENT_VERSION, 2, EGL14.EGL_NONE), 0
        )
        check(context != EGL14.EGL_NO_CONTEXT) { "EGL context gagal dibuat." }
        windowSurface = EGL14.eglCreateWindowSurface(display, config, inputSurface, intArrayOf(EGL14.EGL_NONE), 0)
        check(windowSurface != EGL14.EGL_NO_SURFACE) { "EGL window surface gagal dibuat." }
        makeCurrent()

        val vertex = compileShader(GLES20.GL_VERTEX_SHADER, """
            attribute vec2 aPosition;
            attribute vec2 aTexCoord;
            varying vec2 vTexCoord;
            void main() { gl_Position = vec4(aPosition, 0.0, 1.0); vTexCoord = aTexCoord; }
        """.trimIndent())
        val fragment = compileShader(GLES20.GL_FRAGMENT_SHADER, """
            precision mediump float;
            varying vec2 vTexCoord;
            uniform sampler2D uTexture;
            void main() { gl_FragColor = texture2D(uTexture, vTexCoord); }
        """.trimIndent())
        program = GLES20.glCreateProgram().also {
            GLES20.glAttachShader(it, vertex)
            GLES20.glAttachShader(it, fragment)
            GLES20.glLinkProgram(it)
            val status = IntArray(1)
            GLES20.glGetProgramiv(it, GLES20.GL_LINK_STATUS, status, 0)
            check(status[0] == GLES20.GL_TRUE) { "Shader program gagal: ${GLES20.glGetProgramInfoLog(it)}" }
        }
        GLES20.glDeleteShader(vertex)
        GLES20.glDeleteShader(fragment)
        positionLocation = GLES20.glGetAttribLocation(program, "aPosition")
        texCoordLocation = GLES20.glGetAttribLocation(program, "aTexCoord")
        samplerLocation = GLES20.glGetUniformLocation(program, "uTexture")
        val textures = IntArray(1)
        GLES20.glGenTextures(1, textures, 0)
        textureId = textures[0]
        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, textureId)
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR)
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR)
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE)
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE)
        GLES20.glTexImage2D(GLES20.GL_TEXTURE_2D, 0, GLES20.GL_RGBA, width, height, 0, GLES20.GL_RGBA, GLES20.GL_UNSIGNED_BYTE, null)
        GLES20.glViewport(0, 0, width, height)
    }

    fun draw(rgba: ByteArray, presentationTimeNs: Long) {
        makeCurrent()
        pixelBuffer.clear()
        pixelBuffer.put(rgba)
        pixelBuffer.position(0)
        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, textureId)
        GLES20.glPixelStorei(GLES20.GL_UNPACK_ALIGNMENT, 1)
        GLES20.glTexSubImage2D(GLES20.GL_TEXTURE_2D, 0, 0, 0, width, height, GLES20.GL_RGBA, GLES20.GL_UNSIGNED_BYTE, pixelBuffer)
        GLES20.glUseProgram(program)
        positions.position(0)
        GLES20.glEnableVertexAttribArray(positionLocation)
        GLES20.glVertexAttribPointer(positionLocation, 2, GLES20.GL_FLOAT, false, 0, positions)
        texCoords.position(0)
        GLES20.glEnableVertexAttribArray(texCoordLocation)
        GLES20.glVertexAttribPointer(texCoordLocation, 2, GLES20.GL_FLOAT, false, 0, texCoords)
        GLES20.glActiveTexture(GLES20.GL_TEXTURE0)
        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, textureId)
        GLES20.glUniform1i(samplerLocation, 0)
        GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4)
        GLES20.glDisableVertexAttribArray(positionLocation)
        GLES20.glDisableVertexAttribArray(texCoordLocation)
        check(GLES20.glGetError() == GLES20.GL_NO_ERROR) { "OpenGL gagal menggambar frame." }
        check(EGLExt.eglPresentationTimeANDROID(display, windowSurface, presentationTimeNs)) { "Timestamp EGL gagal." }
        check(EGL14.eglSwapBuffers(display, windowSurface)) { "EGL swapBuffers gagal." }
    }

    fun release() {
        runCatching { makeCurrent(); GLES20.glDeleteTextures(1, intArrayOf(textureId), 0); GLES20.glDeleteProgram(program) }
        EGL14.eglMakeCurrent(display, EGL14.EGL_NO_SURFACE, EGL14.EGL_NO_SURFACE, EGL14.EGL_NO_CONTEXT)
        EGL14.eglDestroySurface(display, windowSurface)
        EGL14.eglDestroyContext(display, context)
        EGL14.eglTerminate(display)
    }

    private fun makeCurrent() {
        check(EGL14.eglMakeCurrent(display, windowSurface, windowSurface, context)) { "EGL makeCurrent gagal." }
    }

    private fun compileShader(type: Int, source: String): Int {
        val shader = GLES20.glCreateShader(type)
        GLES20.glShaderSource(shader, source)
        GLES20.glCompileShader(shader)
        val compiled = IntArray(1)
        GLES20.glGetShaderiv(shader, GLES20.GL_COMPILE_STATUS, compiled, 0)
        if (compiled[0] != GLES20.GL_TRUE) {
            val error = GLES20.glGetShaderInfoLog(shader)
            GLES20.glDeleteShader(shader)
            throw IllegalStateException("Shader compile gagal: $error")
        }
        return shader
    }

    companion object {
        private fun floatBuffer(values: FloatArray): FloatBuffer = ByteBuffer.allocateDirect(values.size * 4)
            .order(ByteOrder.nativeOrder()).asFloatBuffer().apply { put(values); position(0) }
    }
}
