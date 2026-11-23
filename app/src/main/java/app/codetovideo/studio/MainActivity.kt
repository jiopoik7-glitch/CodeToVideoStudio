package app.codetovideo.studio

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import app.codetovideo.studio.core.ProjectRepository
import app.codetovideo.studio.render.RenderController
import app.codetovideo.studio.render.WebCanvasRuntime
import app.codetovideo.studio.ui.StudioApp
import app.codetovideo.studio.ui.theme.StudioTheme

class MainActivity : ComponentActivity() {
    lateinit var projects: ProjectRepository
        private set
    lateinit var canvasRuntime: WebCanvasRuntime
        private set
    lateinit var renderController: RenderController
        private set

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        projects = ProjectRepository(filesDir)
        canvasRuntime = WebCanvasRuntime(this)
        renderController = RenderController(this, canvasRuntime)
        setContent {
            StudioTheme {
                StudioApp(activity = this)
            }
        }
    }

    override fun onDestroy() {
        renderController.shutdown()
        canvasRuntime.destroy()
        super.onDestroy()
    }
}
