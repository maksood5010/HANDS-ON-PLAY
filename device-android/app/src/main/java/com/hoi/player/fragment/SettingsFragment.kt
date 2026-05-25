package com.hoi.player.fragment

import android.app.admin.DevicePolicyManager
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import com.hoi.player.MainActivity
import com.hoi.player.boot.BootForegroundService
import com.hoi.player.databinding.FragmentSettingsBinding
import com.hoi.player.utils.Constants
import com.hoi.player.utils.KioskUtil
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
        binding.etMqttBrokerUrl.setText(Constants.mqttBrokerUrl)
        binding.etMqttTopicPrefix.setText(Constants.mqttTopicPrefix)

        val currentDeviceKey = PreferencesManager.get<String>(Constants.PREF_DEVICE_KEY).orEmpty()
        binding.etDeviceKey.setText(currentDeviceKey)

        binding.btnRemoveDeviceOwner.setOnClickListener {
            val ctx = requireContext()
            val dpm = ctx.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            val wasOwner = dpm.isDeviceOwnerApp(ctx.packageName)
            KioskUtil.removeDeviceOwner(ctx)
            val message = if (wasOwner) {
                "Device owner removed"
            } else {
                "This app is not the device owner"
            }
            Toast.makeText(ctx, message, Toast.LENGTH_LONG).show()
        }

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

            val rawMqttUrl = binding.etMqttBrokerUrl.text?.toString()
            val normalizedMqttUrl = Constants.normalizeMqttBrokerUrl(rawMqttUrl)
            if (normalizedMqttUrl == null) {
                Toast.makeText(
                    requireContext(),
                    "Invalid MQTT Broker URL. Must start with mqtt:// or mqtts://",
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
            PreferencesManager.put(normalizedMqttUrl, Constants.PREF_MQTT_BROKER_URL)

            val topicPrefix = binding.etMqttTopicPrefix.text?.toString()?.trim().orEmpty()
            if (topicPrefix.isNotEmpty()) {
                PreferencesManager.put(topicPrefix.trimEnd('/'), Constants.PREF_MQTT_TOPIC_PREFIX)
            }

            PreferencesManager.put(deviceKey, Constants.PREF_DEVICE_KEY)

            BootForegroundService.startIfNeeded(requireContext())
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
