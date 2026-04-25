package com.hoi.player

import android.os.Bundle
import android.util.Log
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.fragment.app.Fragment
import com.google.firebase.messaging.FirebaseMessaging
import com.hoi.player.databinding.ActivityMainBinding
import com.hoi.player.fragment.HomeFragment
import com.hoi.player.fragment.SetupDeviceFragment
import com.hoi.player.utils.Constants
import com.hoi.player.utils.KioskUtil
import com.hoi.player.utils.PreferencesManager
import com.hoi.player.viewmodel.MainViewModel
import dagger.hilt.android.AndroidEntryPoint
import kotlin.getValue

@AndroidEntryPoint
class MainActivity : AppCompatActivity() {

    private val viewModel: MainViewModel by viewModels()
    val binding: ActivityMainBinding by lazy {
        ActivityMainBinding.inflate(layoutInflater)
    }
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        hideSystemBars()
//        KioskUtil.setDeviceOwner(this)
//        KioskUtil.removeDeviceOwner(this)
        val deviceKey= PreferencesManager.get<String>("device_key")
        if (deviceKey==null){
            replaceFragment(SetupDeviceFragment(),false)
        }else{
            replaceFragment(HomeFragment(),false)
        }

    }

    override fun onResume() {
        super.onResume()
        hideSystemBars()

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
        transaction.add(binding.fragmentContainerView.id, fragment)
        transaction.commit()
    }

}