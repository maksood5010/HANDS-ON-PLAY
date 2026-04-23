package com.hoi.player.fragment

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import com.hoi.player.MainActivity
import com.hoi.player.databinding.FragmentSettingsBinding
import com.hoi.player.utils.Constants
import com.hoi.player.utils.PreferencesManager

class SettingsFragment : Fragment() {

    private val binding: FragmentSettingsBinding by lazy {
        FragmentSettingsBinding.inflate(layoutInflater)
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val currentBaseUrl = PreferencesManager.get<String>(Constants.PREF_BASE_API_URL) ?: Constants.apiUrl
        binding.etBaseUrl.setText(currentBaseUrl)

        val currentDeviceKey = PreferencesManager.get<String>(Constants.PREF_DEVICE_KEY).orEmpty()
        binding.etDeviceKey.setText(currentDeviceKey)

        binding.btnSave.setOnClickListener {
            val rawBaseUrl = binding.etBaseUrl.text?.toString()
            val normalizedBaseUrl = Constants.normalizeBaseUrl(rawBaseUrl)
            if (normalizedBaseUrl == null) {
                Toast.makeText(
                    requireContext(),
                    "Invalid Base API URL. Must start with http:// or https://",
                    Toast.LENGTH_LONG
                ).show()
                return@setOnClickListener
            }

            val deviceKey = binding.etDeviceKey.text?.toString()?.trim().orEmpty()
            if (deviceKey.isEmpty()) {
                Toast.makeText(requireContext(), "Device key is required", Toast.LENGTH_LONG).show()
                return@setOnClickListener
            }

            PreferencesManager.put(normalizedBaseUrl, Constants.PREF_BASE_API_URL)
            PreferencesManager.put(deviceKey, Constants.PREF_DEVICE_KEY)

            restartMainActivity()
        }
    }

    private fun restartMainActivity() {
        val intent = Intent(requireContext(), MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        startActivity(intent)
        requireActivity().finish()
    }
}

