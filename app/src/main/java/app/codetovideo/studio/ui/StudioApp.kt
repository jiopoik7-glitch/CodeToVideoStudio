package app.codetovideo.studio.ui

import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts.CreateDocument
import androidx.activity.result.contract.ActivityResultContracts.OpenDocument
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Slider
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import android.widget.VideoView
import android.widget.MediaController
import app.codetovideo.studio.MainActivity
import app.codetovideo.studio.core.PropType
import app.codetovideo.studio.core.ProjectMetadataParser
import app.codetovideo.studio.core.RenderSettings
import app.codetovideo.studio.core.StudioMetadata
import app.codetovideo.studio.core.StudioProject
import app.codetovideo.studio.storage.GalleryRepository
import app.codetovideo.studio.storage.GalleryVideo
import kotlinx.coroutines.delay
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

private enum class StudioTab(val label: String, val symbol: String) {
    EDITOR("Editor", "{ }"), RENDER("Render", "▶"), GALLERY("Galeri", "▧"), PROJECTS("Simpan", "▤"), DOCS("Docs", "i")
}

@Composable
fun StudioApp(activity: MainActivity) {
    val repository = activity.projects
    var project by remember { mutableStateOf(repository.loadOrCreate()) }
    var selectedTab by remember { mutableStateOf(StudioTab.EDITOR) }
    var savedLabel by remember { mutableStateOf("Autosave aktif") }
    var renderReady by remember { mutableStateOf(false) }
    var exportSupported by remember { mutableStateOf(false) }
    var isRendering by remember { mutableStateOf(false) }
    var renderDone by remember { mutableIntStateOf(0) }
    var renderTotal by remember { mutableIntStateOf(0) }
    var renderMessage by remember { mutableStateOf("") }
    var refreshProjects by remember { mutableIntStateOf(0) }
    var refreshGallery by remember { mutableIntStateOf(0) }

    LaunchedEffect(project.projectId, project.name, project.sourceBody, project.propsValues, project.renderSettings) {
        delay(650)
        runCatching { repository.save(project) }
            .onSuccess {
                savedLabel = "Tersimpan lokal"
                refreshProjects++
            }
            .onFailure { savedLabel = "Gagal menyimpan" }
    }
    LaunchedEffect(Unit) {
        while (true) {
            renderReady = activity.canvasRuntime.ready
            exportSupported = activity.canvasRuntime.exportSupported
            delay(500)
        }
    }

    val importProject = rememberLauncherForActivityResult(OpenDocument()) { uri: Uri? ->
        if (uri != null) runCatching {
            project = repository.importFrom(activity.contentResolver, uri)
            selectedTab = StudioTab.EDITOR
            Toast.makeText(activity, "Proyek berhasil diimpor", Toast.LENGTH_SHORT).show()
        }.onFailure { Toast.makeText(activity, it.message ?: "Import gagal", Toast.LENGTH_LONG).show() }
    }
    val exportProject = rememberLauncherForActivityResult(CreateDocument("application/json")) { uri: Uri? ->
        if (uri != null) runCatching { repository.exportTo(activity.contentResolver, uri, project) }
            .onSuccess { Toast.makeText(activity, "File proyek diekspor", Toast.LENGTH_SHORT).show() }
            .onFailure { Toast.makeText(activity, it.message ?: "Export proyek gagal", Toast.LENGTH_LONG).show() }
    }
    val saveDocs = rememberLauncherForActivityResult(CreateDocument("text/markdown")) { uri: Uri? ->
        if (uri != null) runCatching {
            activity.assets.open("docs/skill.md").use { input ->
                activity.contentResolver.openOutputStream(uri, "wt")?.use { output -> input.copyTo(output) }
                    ?: throw IllegalStateException("File tujuan tidak bisa dibuka.")
            }
        }.onSuccess { Toast.makeText(activity, "Dokumentasi disimpan", Toast.LENGTH_SHORT).show() }
            .onFailure { Toast.makeText(activity, it.message ?: "Gagal menyimpan Docs", Toast.LENGTH_LONG).show() }
    }

    Surface(modifier = Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing), color = Color(0xFF090D19)) {
        Column(Modifier.fillMaxSize()) {
            TopHeader(project.name, savedLabel, renderReady)
            Box(Modifier.weight(1f).fillMaxWidth()) {
                when (selectedTab) {
                    StudioTab.EDITOR -> EditorScreen(
                        project = project,
                        onProjectChange = { project = it },
                        onImport = { importProject.launch(arrayOf("application/json", "text/json")) },
                        onExport = { exportProject.launch("${project.name.replace(Regex("[^A-Za-z0-9_-]"), "_")}.json") }
                    )
                    StudioTab.RENDER -> RenderScreen(
                        project = project,
                        onProjectChange = { project = it },
                        runtime = activity.canvasRuntime,
                        ready = renderReady,
                        exportSupported = exportSupported,
                        isRendering = isRendering,
                        renderDone = renderDone,
                        renderTotal = renderTotal,
                        renderMessage = renderMessage,
                        onPreview = { activity.canvasRuntime.preview(project, it) },
                        onRender = {
                            renderMessage = "Menyiapkan encoder dan file MP4…"
                            isRendering = true
                            renderDone = 0
                            activity.renderController.render(
                                project,
                                onProgress = { done, total ->
                                    renderDone = done
                                    renderTotal = total
                                    renderMessage = "Merender frame $done dari $total"
                                },
                                onComplete = { result ->
                                    isRendering = false
                                    result.onSuccess { uri ->
                                        renderMessage = "MP4 berhasil divalidasi dan disimpan ke Movies/CodeToVideoStudio"
                                        refreshGallery++
                                        Toast.makeText(activity, "Video tersimpan di Galeri", Toast.LENGTH_LONG).show()
                                    }.onFailure { error ->
                                        renderMessage = error.message ?: "Render gagal."
                                        Toast.makeText(activity, renderMessage, Toast.LENGTH_LONG).show()
                                    }
                                }
                            )
                        },
                        onCancel = { activity.renderController.cancel(); renderMessage = "Permintaan pembatalan dikirim." }
                    )
                    StudioTab.GALLERY -> GalleryScreen(
                        activity = activity,
                        keyRefresh = refreshGallery,
                        onShare = { video ->
                            val intent = Intent(Intent.ACTION_SEND).apply {
                                type = "video/mp4"
                                putExtra(Intent.EXTRA_STREAM, video.uri)
                                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                            }
                            activity.startActivity(Intent.createChooser(intent, "Bagikan video"))
                        },
                        onDelete = { video -> runCatching { GalleryRepository(activity).delete(video.uri); refreshGallery++ }
                            .onFailure { Toast.makeText(activity, it.message ?: "Hapus gagal", Toast.LENGTH_LONG).show() } }
                    )
                    StudioTab.PROJECTS -> ProjectsScreen(
                        activity = activity,
                        keyRefresh = refreshProjects,
                        currentProjectId = project.projectId,
                        onOpen = { opened -> project = opened; selectedTab = StudioTab.EDITOR },
                        onNew = { project = repository.save(StudioProject(name = "New Motion")); selectedTab = StudioTab.EDITOR },
                        onDuplicate = { item -> repository.duplicate(item); refreshProjects++ },
                        onRename = { item, name ->
                            val updated = repository.save(item.copy(name = name.take(80)))
                            if (item.projectId == project.projectId) project = updated
                            refreshProjects++
                        },
                        onDelete = { item ->
                            repository.delete(item.projectId)
                            if (item.projectId == project.projectId) project = repository.loadOrCreate()
                            refreshProjects++
                        },
                        onImport = { importProject.launch(arrayOf("application/json", "text/json")) },
                        onExportCurrent = { exportProject.launch("${project.name.replace(Regex("[^A-Za-z0-9_-]"), "_")}.json") }
                    )
                    StudioTab.DOCS -> DocsScreen(activity = activity, onSave = { saveDocs.launch("code-to-video-skill.md") })
                }
            }
            NavigationBar(containerColor = Color(0xFF0E1524), tonalElevation = 0.dp) {
                StudioTab.entries.forEach { tab ->
                    NavigationBarItem(
                        selected = selectedTab == tab,
                        onClick = { selectedTab = tab },
                        icon = { Text(tab.symbol, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold, fontSize = 16.sp) },
                        label = { Text(tab.label, fontSize = 10.sp) }
                    )
                }
            }
        }
    }
}

@Composable
private fun TopHeader(projectName: String, status: String, webReady: Boolean) {
    Row(
        modifier = Modifier.fillMaxWidth().background(Color(0xFF0D1422)).padding(horizontal = 18.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(Modifier.weight(1f)) {
            Text("CODE-TO-VIDEO", color = Color(0xFFF5F7FF), fontWeight = FontWeight.ExtraBold, letterSpacing = 1.2.sp, fontSize = 16.sp)
            Text(projectName, color = Color(0xFF9EACC5), fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Column(horizontalAlignment = Alignment.End) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(7.dp).background(if (webReady) Color(0xFF66E3D1) else Color(0xFFFFC36B), CircleShape))
                Spacer(Modifier.width(6.dp))
                Text("LOCAL · OFFLINE", color = Color(0xFF66E3D1), fontSize = 9.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.8.sp)
            }
            Text(status, color = Color(0xFF71809F), fontSize = 9.sp)
        }
    }
}

@Composable
private fun PageColumn(content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 14.dp), verticalArrangement = Arrangement.spacedBy(12.dp), content = content)
}

@Composable
private fun SectionTitle(title: String, subtitle: String? = null) {
    Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
        Text(title, color = Color(0xFFF5F7FF), fontSize = 20.sp, fontWeight = FontWeight.Bold)
        if (subtitle != null) Text(subtitle, color = Color(0xFF8E9CB7), fontSize = 12.sp)
    }
}

@Composable
private fun Panel(content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF111B2B)),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp), content = content)
    }
}

@Composable
private fun EditorScreen(
    project: StudioProject,
    onProjectChange: (StudioProject) -> Unit,
    onImport: () -> Unit,
    onExport: () -> Unit
) {
    val parsed = remember(project.sourceBody) { runCatching { ProjectMetadataParser.parse(project.sourceBody) } }
    var showTemplates by remember { mutableStateOf(false) }
    PageColumn {
        SectionTitle("Editor", "Tulis JavaScript Canvas 2D. Props dibaca dari metadata JSON statis.")
        Panel {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("SOURCE.JS", color = Color(0xFF66E3D1), fontWeight = FontWeight.Bold, fontSize = 11.sp, letterSpacing = 1.sp)
                    Text("${project.sourceBody.length} / 65.536 karakter", color = Color(0xFF8291AC), fontSize = 10.sp)
                }
                TextButtonSmall("Templates", onClick = { showTemplates = true })
                TextButtonSmall("Reset", onClick = { onProjectChange(project.copy(sourceBody = app.codetovideo.studio.core.DEFAULT_SOURCE, propsValues = emptyMap())) })
            }
            Box(Modifier.fillMaxWidth().height(330.dp).background(Color(0xFF080E19), RoundedCornerShape(12.dp)).padding(12.dp)) {
                BasicTextField(
                    value = project.sourceBody,
                    onValueChange = { value -> if (value.length <= 65_536) onProjectChange(project.copy(sourceBody = value)) },
                    modifier = Modifier.fillMaxSize(),
                    textStyle = androidx.compose.ui.text.TextStyle(color = Color(0xFFD5E0F4), fontFamily = FontFamily.Monospace, fontSize = 11.sp, lineHeight = 16.sp),
                    cursorBrush = androidx.compose.ui.graphics.SolidColor(Color(0xFF66E3D1))
                )
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = onImport, modifier = Modifier.weight(1f)) { Text("Import JSON", fontSize = 11.sp) }
                OutlinedButton(onClick = onExport, modifier = Modifier.weight(1f)) { Text("Export JSON", fontSize = 11.sp) }
            }
        }
        if (parsed.isFailure) {
            Panel {
                Text("Metadata error", color = Color(0xFFFF8B9A), fontWeight = FontWeight.Bold)
                Text(parsed.exceptionOrNull()?.message ?: "Metadata tidak valid.", color = Color(0xFFFFC4CB), fontSize = 12.sp)
            }
        } else {
            val metadata = parsed.getOrThrow()
            PropsPanel(metadata = metadata, values = project.propsValues, onChange = { onProjectChange(project.copy(propsValues = it)) })
        }
        Text("Kode dijalankan di Dedicated Worker tanpa DOM. Gunakan t, p, frame, ease, dan rand(index) untuk animasi deterministik.", color = Color(0xFF75839E), fontSize = 11.sp)
    }
    if (showTemplates) {
        AlertDialog(
            onDismissRequest = { showTemplates = false },
            title = { Text("Pilih template") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    TextButton(onClick = { onProjectChange(project.copy(name = "Kinetic Title", sourceBody = app.codetovideo.studio.core.DEFAULT_SOURCE, propsValues = emptyMap())); showTemplates = false }) { Text("Kinetic Title · Typography") }
                    TextButton(onClick = { onProjectChange(project.copy(name = "Orbit Geometry", sourceBody = ORBIT_TEMPLATE, propsValues = emptyMap())); showTemplates = false }) { Text("Orbit Geometry · Shapes") }
                    TextButton(onClick = { onProjectChange(project.copy(name = "Progress Counter", sourceBody = COUNTER_TEMPLATE, propsValues = emptyMap())); showTemplates = false }) { Text("Progress Counter · Data") }
                }
            },
            confirmButton = { TextButton(onClick = { showTemplates = false }) { Text("Tutup") } }
        )
    }
}

private val ORBIT_TEMPLATE = """/*<studio-meta>
{"schemaVersion":1,"title":"Orbit Geometry","defaultDurationSeconds":5,"seed":23,"props":[{"key":"accent","label":"Accent","type":"color","default":"#9EAFFF"}]}
</studio-meta>*/
ctx.fillStyle = "#090D19"; ctx.fillRect(0,0,W,H);
const cx=W/2, cy=H/2, radius=Math.min(W,H)*0.22;
for(let i=0;i<7;i++){
  const a=t*0.8+i*Math.PI*2/7;
  const x=cx+Math.cos(a)*radius, y=cy+Math.sin(a)*radius;
  ctx.beginPath(); ctx.arc(x,y,Math.max(9,18*S),0,Math.PI*2);
  ctx.fillStyle=P.accent||"#9EAFFF"; ctx.globalAlpha=0.35+0.65*ease.outCubic(p);
  ctx.fill(); ctx.globalAlpha=1;
}
ctx.beginPath(); ctx.arc(cx,cy,Math.max(22,48*S),0,Math.PI*2);
ctx.fillStyle="#F5F7FF"; ctx.fill();
ctx.textAlign="center"; ctx.fillStyle="#F5F7FF"; ctx.font=`700 ${'$'}{Math.max(18,32*S)}px sans-serif`;
ctx.fillText("ORBIT / 07",cx,cy+Math.min(H,W)*0.36);
"""

private val COUNTER_TEMPLATE = """/*<studio-meta>
{"schemaVersion":1,"title":"Progress Counter","defaultDurationSeconds":5,"seed":31,"props":[{"key":"label","label":"Label","type":"text","default":"PROGRESS"},{"key":"accent","label":"Accent","type":"color","default":"#66E3D1"}]}
</studio-meta>*/
ctx.fillStyle="#0B1020"; ctx.fillRect(0,0,W,H);
const value=Math.round(ease.inOutCubic(p)*100);
ctx.textAlign="center"; ctx.textBaseline="middle";
ctx.fillStyle="#F5F7FF"; ctx.font=`800 ${'$'}{Math.max(72,180*S)}px sans-serif`;
ctx.fillText(String(value).padStart(2,"0"),W/2,H/2);
ctx.fillStyle="#AAB4CC"; ctx.font=`600 ${'$'}{Math.max(16,28*S)}px sans-serif`;
ctx.fillText(String(P.label||"PROGRESS").toUpperCase(),W/2,H*0.68);
ctx.fillStyle="#27354A"; ctx.fillRect(W*0.16,H*0.78,W*0.68,Math.max(4,8*S));
ctx.fillStyle=P.accent||"#66E3D1"; ctx.fillRect(W*0.16,H*0.78,W*0.68*p,Math.max(4,8*S));
"""

@Composable
private fun PropsPanel(metadata: StudioMetadata, values: Map<String, String>, onChange: (Map<String, String>) -> Unit) {
    Panel {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("PROPS", color = Color(0xFF66E3D1), fontWeight = FontWeight.Bold, letterSpacing = 1.sp, fontSize = 11.sp)
            Spacer(Modifier.weight(1f))
            Text("${metadata.props.size} controls", color = Color(0xFF8291AC), fontSize = 10.sp)
        }
        if (metadata.props.isEmpty()) Text("Tambahkan blok studio-meta di awal source untuk membuat kontrol Props.", color = Color(0xFF9EACC5), fontSize = 12.sp)
        metadata.props.forEach { prop ->
            val value = values[prop.key] ?: prop.defaultValue
            Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
                Text(prop.label, color = Color(0xFFDCE5F6), fontSize = 12.sp, fontWeight = FontWeight.Medium)
                when (prop.type) {
                    PropType.TEXT, PropType.COLOR -> OutlinedTextField(
                        value = value,
                        onValueChange = { next -> onChange(values + (prop.key to next.take(256))) },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        textStyle = androidx.compose.ui.text.TextStyle(fontSize = 12.sp, fontFamily = FontFamily.Monospace),
                        label = { Text(if (prop.type == PropType.COLOR) "Warna HEX" else "Teks", fontSize = 10.sp) }
                    )
                    PropType.RANGE -> {
                        val number = value.toFloatOrNull()?.coerceIn(prop.min, prop.max) ?: prop.min
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Slider(value = number, onValueChange = { next -> onChange(values + (prop.key to next.toString())) }, valueRange = prop.min..prop.max, modifier = Modifier.weight(1f))
                            Text("%.2f".format(number), color = Color(0xFF66E3D1), fontSize = 11.sp, modifier = Modifier.width(48.dp))
                        }
                    }
                    PropType.BOOLEAN -> Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(if (value.equals("true", true)) "Aktif" else "Nonaktif", color = Color(0xFF9EACC5), fontSize = 11.sp, modifier = Modifier.weight(1f))
                        Switch(checked = value.equals("true", true), onCheckedChange = { onChange(values + (prop.key to it.toString())) })
                    }
                }
            }
        }
    }
}

@Composable
private fun RenderScreen(
    project: StudioProject,
    onProjectChange: (StudioProject) -> Unit,
    runtime: app.codetovideo.studio.render.WebCanvasRuntime,
    ready: Boolean,
    exportSupported: Boolean,
    isRendering: Boolean,
    renderDone: Int,
    renderTotal: Int,
    renderMessage: String,
    onPreview: (Int) -> Unit,
    onRender: () -> Unit,
    onCancel: () -> Unit
) {
    var previewFrame by remember { mutableIntStateOf(0) }
    LaunchedEffect(project.renderSettings.totalFrames()) {
        previewFrame = previewFrame.coerceIn(0, (project.renderSettings.totalFrames() - 1).coerceAtLeast(0))
    }
    LaunchedEffect(project.projectId, project.sourceBody, project.propsValues, project.renderSettings, previewFrame, ready) {
        if (ready) onPreview(previewFrame)
    }
    PageColumn {
        SectionTitle("Render Studio", "Frame-based output · H.264 / MP4 · pemrosesan lokal")
        Panel {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("LIVE CANVAS PREVIEW", color = Color(0xFF66E3D1), fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
                Spacer(Modifier.weight(1f))
                Text(if (ready) "WEBVIEW READY" else "LOADING RUNTIME", color = if (ready) Color(0xFF66E3D1) else Color(0xFFFFC36B), fontSize = 9.sp)
            }
            Box(Modifier.fillMaxWidth().height(270.dp).background(Color(0xFF080E19), RoundedCornerShape(12.dp)), contentAlignment = Alignment.Center) {
                AndroidView(
                    factory = { runtime.createWebView() },
                    modifier = Modifier.fillMaxSize(),
                    update = { if (ready) runtime.preview(project, previewFrame) }
                )
                if (!ready) CircularProgressIndicator(color = Color(0xFF66E3D1), modifier = Modifier.size(28.dp), strokeWidth = 2.dp)
            }
            Text("Frame ${previewFrame + 1} / ${project.renderSettings.totalFrames()}", color = Color(0xFF9EACC5), fontSize = 11.sp)
            Slider(
                value = previewFrame.toFloat(),
                onValueChange = { previewFrame = it.toInt() },
                valueRange = 0f..(project.renderSettings.totalFrames() - 1).coerceAtLeast(1).toFloat()
            )
            OutlinedButton(onClick = { onPreview(previewFrame) }, enabled = ready, modifier = Modifier.fillMaxWidth()) { Text("Refresh Preview") }
        }
        Panel {
            Text("OUTPUT SETTINGS", color = Color(0xFF66E3D1), fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
            SettingChips("Resolusi sisi panjang", listOf("480", "720", "1080", "1440", "2160"), project.renderSettings.longEdge.toString()) {
                onProjectChange(project.copy(renderSettings = project.renderSettings.copy(longEdge = it.toInt())))
            }
            SettingChips("Aspect ratio", listOf("9:16", "16:9", "1:1", "4:5"), project.renderSettings.aspect) {
                onProjectChange(project.copy(renderSettings = project.renderSettings.copy(aspect = it)))
            }
            SettingChips("Frame rate", listOf("24", "30", "60"), project.renderSettings.fps.toString()) {
                onProjectChange(project.copy(renderSettings = project.renderSettings.copy(fps = it.toInt())))
            }
            SettingChips("Quality", listOf("low", "medium", "high", "ultra"), project.renderSettings.quality) {
                onProjectChange(project.copy(renderSettings = project.renderSettings.copy(quality = it)))
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Durasi", color = Color(0xFFDCE5F6), fontSize = 12.sp, modifier = Modifier.weight(1f))
                SettingChipsInline(listOf("3s", "5s", "10s", "15s", "30s"), "${project.renderSettings.durationSeconds}s") {
                    onProjectChange(project.copy(renderSettings = project.renderSettings.copy(durationSeconds = it.removeSuffix("s").toInt())))
                }
            }
            val (w, h) = project.renderSettings.dimensions()
            Text("Output: ${w}×${h} px · ${project.renderSettings.totalFrames()} frames · H.264 / MP4", color = Color(0xFF8291AC), fontSize = 10.sp)
        }
        Panel {
            Text("EXPORT", color = Color(0xFF66E3D1), fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
            Text(
                when {
                    !ready -> "Menunggu WebView memuat runtime lokal."
                    !exportSupported -> "WebView ini belum mengonfirmasi OffscreenCanvas Worker dan ArrayBuffer bridge. Perbarui Android System WebView jika ekspor belum tersedia."
                    else -> "Frame dikirim satu per satu dengan ACK/backpressure. Video divalidasi sebelum dipublikasikan ke Galeri."
                },
                color = Color(0xFF9EACC5), fontSize = 11.sp
            )
            if (isRendering) {
                LinearProgressIndicator(progress = { if (renderTotal > 0) renderDone.toFloat() / renderTotal else 0f }, modifier = Modifier.fillMaxWidth(), color = Color(0xFF66E3D1))
                Text(renderMessage, color = Color(0xFFB9C6DD), fontSize = 11.sp)
                OutlinedButton(onClick = onCancel, modifier = Modifier.fillMaxWidth()) { Text("Cancel Render") }
            } else {
                Button(onClick = onRender, enabled = ready && exportSupported, modifier = Modifier.fillMaxWidth()) { Text("Render MP4") }
                if (renderMessage.isNotBlank()) Text(renderMessage, color = Color(0xFF9EACC5), fontSize = 11.sp)
            }
        }
        Text("Catatan: durasi render bergantung pada codec, suhu, memori, dan kemampuan perangkat. Preset 4K/60 FPS tidak dijanjikan pada HP kelas rendah.", color = Color(0xFF75839E), fontSize = 10.sp)
    }
}

@Composable
private fun SettingChips(title: String, options: List<String>, selected: String, onSelect: (String) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
        Text(title, color = Color(0xFFDCE5F6), fontSize = 12.sp)
        Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(5.dp)) {
            options.forEach { option ->
                FilterChip(selected = selected == option, onClick = { onSelect(option) }, label = { Text(option, fontSize = 10.sp) })
            }
        }
    }
}

@Composable
private fun SettingChipsInline(options: List<String>, selected: String, onSelect: (String) -> Unit) {
    Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        options.forEach { option ->
            FilterChip(selected = selected == option, onClick = { onSelect(option) }, label = { Text(option, fontSize = 9.sp) })
        }
    }
}

@Composable
private fun GalleryScreen(
    activity: MainActivity,
    keyRefresh: Int,
    onShare: (GalleryVideo) -> Unit,
    onDelete: (GalleryVideo) -> Unit
) {
    var videos by remember { mutableStateOf<List<GalleryVideo>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var selectedVideo by remember { mutableStateOf<GalleryVideo?>(null) }
    LaunchedEffect(keyRefresh) {
        loading = true
        videos = withContext(Dispatchers.IO) { runCatching { GalleryRepository(activity).videos() }.getOrDefault(emptyList()) }
        loading = false
    }
    PageColumn {
        SectionTitle("Galeri", "Video yang diekspor ke Movies/CodeToVideoStudio")
        if (loading) CircularProgressIndicator(color = Color(0xFF66E3D1))
        else if (videos.isEmpty()) Panel {
            Text("Belum ada video", color = Color(0xFFF5F7FF), fontWeight = FontWeight.Bold)
            Text("Hasil render MP4 akan muncul di sini setelah file selesai divalidasi.", color = Color(0xFF9EACC5), fontSize = 12.sp)
        }
        videos.forEach { video ->
            Panel {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(44.dp).background(Color(0xFF1B2B3F), RoundedCornerShape(12.dp)), contentAlignment = Alignment.Center) {
                        Text("▶", color = Color(0xFF66E3D1), fontSize = 18.sp)
                    }
                    Spacer(Modifier.width(10.dp))
                    Column(Modifier.weight(1f)) {
                        Text(video.name, color = Color(0xFFF5F7FF), fontWeight = FontWeight.SemiBold, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text("${video.durationLabel()} · ${GalleryRepository(activity).sizeLabel(video.sizeBytes)}", color = Color(0xFF9EACC5), fontSize = 10.sp)
                        Text(video.dateLabel(), color = Color(0xFF71809F), fontSize = 9.sp)
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(onClick = { selectedVideo = video }, modifier = Modifier.weight(1f)) { Text("Putar", fontSize = 11.sp) }
                    OutlinedButton(onClick = { onShare(video) }, modifier = Modifier.weight(1f)) { Text("Bagikan", fontSize = 11.sp) }
                    TextButtonSmall("Hapus", onClick = { onDelete(video) })
                }
            }
        }
    }
    selectedVideo?.let { video ->
        AlertDialog(
            onDismissRequest = { selectedVideo = null },
            title = { Text(video.name, maxLines = 1, overflow = TextOverflow.Ellipsis) },
            text = {
                AndroidView(
                    factory = { ctx ->
                        VideoView(ctx).apply {
                            setMediaController(MediaController(ctx))
                            setVideoURI(video.uri)
                            setOnPreparedListener { player -> player.isLooping = false; start() }
                        }
                    },
                    modifier = Modifier.fillMaxWidth().height(220.dp)
                )
            },
            confirmButton = { TextButton(onClick = { selectedVideo = null }) { Text("Tutup") } }
        )
    }
}

@Composable
private fun ProjectsScreen(
    activity: MainActivity,
    keyRefresh: Int,
    currentProjectId: String,
    onOpen: (StudioProject) -> Unit,
    onNew: () -> Unit,
    onDuplicate: (StudioProject) -> Unit,
    onRename: (StudioProject, String) -> Unit,
    onDelete: (StudioProject) -> Unit,
    onImport: () -> Unit,
    onExportCurrent: () -> Unit
) {
    var projects by remember { mutableStateOf<List<StudioProject>>(emptyList()) }
    var renameTarget by remember { mutableStateOf<StudioProject?>(null) }
    var renameValue by remember { mutableStateOf("") }
    LaunchedEffect(keyRefresh) { projects = withContext(Dispatchers.IO) { activity.projects.list() } }
    PageColumn {
        SectionTitle("Simpan", "Proyek JSON tersimpan di ruang privat aplikasi.")
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = onNew, modifier = Modifier.weight(1f)) { Text("+ New Project", fontSize = 11.sp) }
            OutlinedButton(onClick = onImport, modifier = Modifier.weight(1f)) { Text("Import", fontSize = 11.sp) }
        }
        OutlinedButton(onClick = onExportCurrent, modifier = Modifier.fillMaxWidth()) { Text("Export proyek aktif sebagai JSON") }
        if (projects.isEmpty()) Panel { Text("Belum ada proyek tersimpan.", color = Color(0xFF9EACC5), fontSize = 12.sp) }
        projects.forEach { item ->
            Panel {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(item.name, color = Color(0xFFF5F7FF), fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        Text(if (item.projectId == currentProjectId) "PROYEK AKTIF" else "${item.renderSettings.aspect} · ${item.renderSettings.fps} FPS", color = Color(0xFF66E3D1), fontSize = 9.sp)
                    }
                    TextButtonSmall("Open", onClick = { onOpen(item) })
                }
                Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                    TextButtonSmall("Duplicate", onClick = { onDuplicate(item) })
                    TextButtonSmall("Rename", onClick = { renameTarget = item; renameValue = item.name })
                    TextButtonSmall("Delete", onClick = { onDelete(item) })
                }
            }
        }
    }
    renameTarget?.let { target ->
        AlertDialog(
            onDismissRequest = { renameTarget = null },
            title = { Text("Rename project") },
            text = { OutlinedTextField(value = renameValue, onValueChange = { renameValue = it.take(80) }, singleLine = true) },
            confirmButton = { TextButton(onClick = { if (renameValue.isNotBlank()) onRename(target, renameValue.trim()); renameTarget = null }) { Text("Save") } },
            dismissButton = { TextButton(onClick = { renameTarget = null }) { Text("Cancel") } }
        )
    }
}

@Composable
private fun DocsScreen(activity: MainActivity, onSave: () -> Unit) {
    val content = remember { activity.assets.open("docs/skill.md").bufferedReader().use { it.readText() } }
    val clipboard = androidx.compose.ui.platform.LocalClipboardManager.current
    PageColumn {
        SectionTitle("Docs", "Kontrak output AI Agent dan aturan Canvas Worker.")
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = { clipboard.setText(androidx.compose.ui.text.AnnotatedString(content)); Toast.makeText(activity, "Docs disalin", Toast.LENGTH_SHORT).show() }, modifier = Modifier.weight(1f)) { Text("Salin") }
            OutlinedButton(onClick = onSave, modifier = Modifier.weight(1f)) { Text("Unduh .md") }
        }
        Panel {
            Text(content, color = Color(0xFFD0D9EA), fontFamily = FontFamily.Monospace, fontSize = 10.sp, lineHeight = 15.sp)
        }
    }
}

@Composable
private fun TextButtonSmall(label: String, onClick: () -> Unit) {
    TextButton(onClick = onClick) { Text(label, fontSize = 10.sp) }
}

