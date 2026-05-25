package com.hoi.player.ui

import android.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import android.view.LayoutInflater
import android.view.WindowManager
import android.widget.ProgressBar
import android.widget.TextView
import com.hoi.player.R
import com.hoi.player.viewmodel.AppUpdateUiState

class AppUpdateProgressDialog(private val activity: AppCompatActivity) {
    private val dialogView = LayoutInflater.from(activity)
        .inflate(R.layout.dialog_app_update_progress, null)

    private val titleView: TextView = dialogView.findViewById(R.id.tvAppUpdateTitle)
    private val progressBar: ProgressBar = dialogView.findViewById(R.id.progressAppUpdate)
    private val statusView: TextView = dialogView.findViewById(R.id.tvAppUpdateStatus)

    private var dialog: AlertDialog? = null

    fun bind(state: AppUpdateUiState) {
        if (activity.isFinishing || activity.isDestroyed) return

        when (state) {
            is AppUpdateUiState.Idle -> dismiss()
            is AppUpdateUiState.StoppingPlayback -> {
                show()
                titleView.setText(R.string.app_update_dialog_title)
                statusView.setText(R.string.app_update_dialog_status_stopping)
                progressBar.isIndeterminate = true
            }
            is AppUpdateUiState.Downloading -> {
                show()
                titleView.setText(R.string.app_update_dialog_title)
                progressBar.isIndeterminate = false
                val percent = state.percent.coerceIn(0, 100)
                progressBar.progress = percent
                statusView.text = activity.getString(
                    R.string.app_update_dialog_status_percent,
                    percent
                )
            }
            is AppUpdateUiState.Installing -> {
                show()
                progressBar.isIndeterminate = true
                statusView.setText(R.string.app_update_dialog_status_installing)
            }
            is AppUpdateUiState.Complete,
            is AppUpdateUiState.Error -> dismiss()
        }
    }

    private fun requireDialog(): AlertDialog {
        val existing = dialog
        if (existing != null) return existing
        return AlertDialog.Builder(activity)
            .setView(dialogView)
            .setCancelable(false)
            .create()
            .also { created ->
                dialog = created
            }
    }

    private fun show() {
        if (activity.isFinishing || activity.isDestroyed) return
        val d = requireDialog()
        if (!d.isShowing) {
            d.setCancelable(false)
            d.show()
        }
    }

    fun dismiss() {
        val d = dialog ?: return
        try {
            if (d.isShowing) {
                d.dismiss()
            }
        } catch (_: WindowManager.BadTokenException) {
            // Activity window already gone.
        } catch (_: IllegalArgumentException) {
            // View not attached to window manager.
        }
    }

    fun release() {
        dismiss()
        dialog = null
    }
}
