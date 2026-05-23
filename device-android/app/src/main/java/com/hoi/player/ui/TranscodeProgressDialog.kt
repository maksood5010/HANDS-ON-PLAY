package com.hoi.player.ui

import android.app.AlertDialog
import android.content.Context
import android.view.LayoutInflater
import android.widget.Button
import android.widget.ProgressBar
import android.widget.TextView
import com.hoi.player.R

class TranscodeProgressDialog(
    context: Context,
    private val onSkip: (fileId: Int) -> Unit
) {
    private val dialogView = LayoutInflater.from(context)
        .inflate(R.layout.dialog_transcode_progress, null)

    private val titleView: TextView = dialogView.findViewById(R.id.tvTranscodeTitle)
    private val videoNameView: TextView = dialogView.findViewById(R.id.tvTranscodeVideoName)
    private val progressBar: ProgressBar = dialogView.findViewById(R.id.progressTranscode)
    private val statusView: TextView = dialogView.findViewById(R.id.tvTranscodeStatus)
    private val skipButton: Button = dialogView.findViewById(R.id.btnTranscodeSkip)

    private var blockedFileId: Int? = null

    private val dialog: AlertDialog = AlertDialog.Builder(context)
        .setView(dialogView)
        .setCancelable(false)
        .create()

    init {
        skipButton.setOnClickListener {
            blockedFileId?.let(onSkip)
        }
    }

    fun show(fileId: Int, label: String?, progressPercent: Int) {
        blockedFileId = fileId
        titleView.setText(R.string.transcode_dialog_title)
        if (!label.isNullOrBlank()) {
            videoNameView.text = label
            videoNameView.visibility = android.view.View.VISIBLE
        } else {
            videoNameView.visibility = android.view.View.GONE
        }
        updateProgress(progressPercent)
        if (!dialog.isShowing) {
            dialog.show()
            skipButton.requestFocus()
        }
    }

    fun updateProgress(progressPercent: Int) {
        val percent = progressPercent.coerceIn(0, 100)
        progressBar.progress = percent
        statusView.text = dialogView.context.getString(
            R.string.transcode_dialog_status_percent,
            percent
        )
    }

    fun dismiss() {
        blockedFileId = null
        if (dialog.isShowing) {
            dialog.dismiss()
        }
    }

    val isShowing: Boolean
        get() = dialog.isShowing
}
