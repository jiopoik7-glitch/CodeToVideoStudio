package app.codetovideo.studio.core

import android.content.ContentResolver
import android.net.Uri
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.nio.file.Files
import java.nio.file.StandardCopyOption

class ProjectRepository(private val root: File) {
    private val projectsDir = File(root, "projects")

    init { projectsDir.mkdirs() }

    @Synchronized
    fun save(project: StudioProject): StudioProject {
        projectsDir.mkdirs()
        val updated = project.copy(updatedAtEpochMs = System.currentTimeMillis())
        val destination = File(projectsDir, "${updated.projectId}.json")
        val temp = File(projectsDir, "${updated.projectId}.json.tmp")
        FileOutputStream(temp).use { stream ->
            stream.write(updated.toJson().toString(2).toByteArray(Charsets.UTF_8))
            stream.fd.sync()
        }
        try {
            Files.move(temp.toPath(), destination.toPath(), StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE)
        } catch (error: Exception) {
            temp.delete()
            throw IllegalStateException("Tidak bisa menyimpan proyek secara atomik: ${error.message}")
        }
        return updated
    }

    fun list(): List<StudioProject> = projectsDir.listFiles { file -> file.isFile && file.extension == "json" }
        ?.mapNotNull { file -> runCatching { StudioProject.fromJson(JSONObject(file.readText())) }.getOrNull() }
        ?.sortedByDescending { it.updatedAtEpochMs }
        ?: emptyList()

    fun loadOrCreate(): StudioProject = list().firstOrNull() ?: save(StudioProject())

    @Synchronized
    fun delete(projectId: String) {
        File(projectsDir, "$projectId.json").takeIf { it.exists() }?.delete()
    }

    fun duplicate(project: StudioProject): StudioProject = save(
        project.copy(projectId = java.util.UUID.randomUUID().toString(), name = "${project.name} copy", createdAtEpochMs = System.currentTimeMillis())
    )

    fun importFrom(resolver: ContentResolver, uri: Uri): StudioProject {
        val json = resolver.openInputStream(uri)?.bufferedReader()?.use { it.readText() }
            ?: throw IllegalArgumentException("File proyek tidak bisa dibaca.")
        require(json.length <= 1_000_000) { "Ukuran file proyek terlalu besar." }
        val parsed = StudioProject.fromJson(JSONObject(json))
        val imported = parsed.copy(
            projectId = java.util.UUID.randomUUID().toString(),
            name = "${parsed.name} (imported)"
        )
        return save(imported)
    }

    fun exportTo(resolver: ContentResolver, uri: Uri, project: StudioProject) {
        resolver.openOutputStream(uri, "wt")?.bufferedWriter()?.use { writer -> writer.write(project.toJson().toString(2)) }
            ?: throw IllegalArgumentException("File tujuan tidak bisa ditulis.")
    }
}
