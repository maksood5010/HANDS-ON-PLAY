package com.hoi.player

import android.os.Bundle
import android.util.Log
import android.widget.Toast
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.asFlow
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.fragment.app.Fragment
import com.google.firebase.messaging.FirebaseMessaging
import com.hoi.player.BuildConfig
import com.hoi.player.databinding.ActivityMainBinding
import com.hoi.player.boot.BootForegroundService
import com.hoi.player.fragment.HomeFragment
import com.hoi.player.fragment.SetupDeviceFragment
import com.hoi.player.utils.Constants
import com.hoi.player.utils.KioskUtil
import com.hoi.player.utils.PreferencesManager
import com.hoi.player.ui.AppUpdateProgressDialog
import com.hoi.player.viewmodel.AppUpdateUiState
import com.hoi.player.viewmodel.AppUpdateViewModel
import com.hoi.player.viewmodel.MainViewModel
import dagger.hilt.android.AndroidEntryPoint
import kotlin.getValue
import kotlinx.coroutines.launch

@AndroidEntryPoint
class MainActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "MainActivity"
    }

    private val viewModel: MainViewModel by viewModels()
    private val appUpdateViewModel: AppUpdateViewModel by viewModels()
    private var appUpdateProgressDialog: AppUpdateProgressDialog? = null

    val binding: ActivityMainBinding by lazy {
        ActivityMainBinding.inflate(layoutInflater)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(binding.root)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        hideSystemBars()
        KioskUtil.setDeviceOwner(this)
//        KioskUtil.removeDeviceOwner(this)

        Log.d(
            TAG,
            "app version=${BuildConfig.VERSION_NAME} (versionCode=${BuildConfig.VERSION_CODE})"
        )

        appUpdateViewModel.clearUpdateError()
        appUpdateProgressDialog = AppUpdateProgressDialog(this)
        observeAppUpdateUiState()

        val deviceKey = PreferencesManager.get<String>(Constants.PREF_DEVICE_KEY)
        if (deviceKey == null) {
            replaceFragment(SetupDeviceFragment(), false)
        } else {
            BootForegroundService.startIfNeeded(this)
            replaceFragment(HomeFragment(), false)
        }

        handleAppUpdateIntent(intent)
    }

    override fun onNewIntent(intent: android.content.Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleAppUpdateIntent(intent)
    }

    private fun observeAppUpdateUiState() {
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                appUpdateViewModel.updateUiState.asFlow().collect { state ->
                    renderAppUpdateState(state)
                }
            }
        }
    }

    private fun renderAppUpdateState(state: AppUpdateUiState) {
        when (state) {
            is AppUpdateUiState.Error -> {
                appUpdateProgressDialog?.dismiss()
                Toast.makeText(this, state.message, Toast.LENGTH_LONG).show()
                appUpdateViewModel.clearUpdateError()
            }
            is AppUpdateUiState.Idle,
            is AppUpdateUiState.Complete -> appUpdateProgressDialog?.dismiss()
            else -> appUpdateProgressDialog?.bind(state)
        }
    }

    override fun onDestroy() {
        appUpdateProgressDialog?.release()
        appUpdateProgressDialog = null
        super.onDestroy()
    }

    private fun handleAppUpdateIntent(intent: android.content.Intent?) {
        val url = intent?.getStringExtra(Constants.EXTRA_APP_UPDATE_URL)?.trim().orEmpty()
        if (url.isNotEmpty()) {
            appUpdateViewModel.onUpdateRequested(url)
            intent?.removeExtra(Constants.EXTRA_APP_UPDATE_URL)
        }
    }

    override fun onResume() {
        super.onResume()
        hideSystemBars()

        FirebaseMessaging.getInstance().token
            .addOnCompleteListener { task ->
                if (!task.isSuccessful) {
                    Log.w("FCM_CHECK", "getToken failed", task.exception)
                    return@addOnCompleteListener
                }
                val token = task.result
                Log.d("FCM_CHECK", "token=${token}")
            }

        // Ensure this device stays subscribed to its assigned group topic.
        val savedTopic = PreferencesManager.get<String>(Constants.PREF_FCM_TOPIC)
        if (!savedTopic.isNullOrBlank()) {
            FirebaseMessaging.getInstance()
                .subscribeToTopic(savedTopic)
                .addOnCompleteListener { task ->
                    Log.d(
                        "FCM_CHECK",
                        "subscribeToTopic($savedTopic) success=${task.isSuccessful}"
                    )
                }
        } else {
            Log.w("FCM_CHECK", "No saved group topic in prefs (${Constants.PREF_FCM_TOPIC})")
        }

        // Also stay subscribed to the company-wide topic used for "All devices" actions.
        val companyId = PreferencesManager.get<String>(Constants.PREF_COMPANY_ID)
        if (!companyId.isNullOrBlank()) {
            val companyTopic = "c_${companyId}_all"
            FirebaseMessaging.getInstance()
                .subscribeToTopic(companyTopic)
                .addOnCompleteListener { task ->
                    Log.d("FCM_CHECK", "subscribeToTopic($companyTopic) success=${task.isSuccessful}")
                }
        } else {
            Log.w("FCM_CHECK", "No saved company id in prefs (${Constants.PREF_COMPANY_ID})")
        }
    }

    private fun hideSystemBars() {
        val controller = WindowInsetsControllerCompat(window, window.decorView)
        controller.systemBarsBehavior =
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        controller.hide(WindowInsetsCompat.Type.statusBars())
    }

    fun replaceFragment(fragment: Fragment, back: Boolean = true) {
        Log.d(fragment.javaClass.simpleName, "replaceFragment: ")
        val transaction = supportFragmentManager.beginTransaction()
        if (back) {
            transaction.addToBackStack(fragment.javaClass.simpleName)
        }
        transaction.replace(binding.fragmentContainerView.id, fragment)
        transaction.commit()
    }

}