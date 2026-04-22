package com.hoi.player

import android.os.Bundle
import android.util.Log
import android.view.View
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.fragment.app.Fragment
import com.hoi.player.databinding.ActivityMainBinding
import com.hoi.player.fragment.HomeFragment
import com.hoi.player.fragment.SetupDeviceFragment
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
        enableEdgeToEdge()
        setContentView(R.layout.activity_main)
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.main)) { v, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom)
            insets
        }
        window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        or View.SYSTEM_UI_FLAG_FULLSCREEN
                        or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                )
//        KioskUtil.setDeviceOwner(this)
//        KioskUtil.removeDeviceOwner(this)
        val deviceKey= PreferencesManager.get<String>("device_key")
        if (deviceKey==null){
            replaceFragment(SetupDeviceFragment(),false)
        }else{
            replaceFragment(HomeFragment(),false)
        }

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