package com.hoi.player.fragment

import android.app.AlertDialog
import android.content.Context
import android.os.Bundle
import android.view.inputmethod.InputMethodManager
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import android.util.Log
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.lifecycle.Observer
import com.hoi.player.MainActivity
import com.hoi.player.databinding.FragmentSetupDeviceBinding
import com.hoi.player.utils.Constants
import com.hoi.player.utils.PreferencesManager
import com.hoi.player.viewmodel.MainViewModel
import com.google.firebase.messaging.FirebaseMessaging

class SetupDeviceFragment : Fragment() {

    private val viewModel: MainViewModel by activityViewModels()
    val binding: FragmentSetupDeviceBinding by lazy {
        FragmentSetupDeviceBinding.inflate(layoutInflater)
    }
    var deviceKey =""
    private var loadingDialog: AlertDialog? = null

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        // Inflate the layout for this fragment
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        fun showToast(message: String) {
            Toast.makeText(requireContext(), message, Toast.LENGTH_SHORT).show()
        }

        val currentBaseUrl =
            PreferencesManager.get<String>(Constants.PREF_BASE_API_URL) ?: Constants.apiUrl
        binding.etBaseUrl.setText(currentBaseUrl)

        with(viewModel) {
            deviceValidationResult.observe(viewLifecycleOwner) { result ->
                loadingDialog?.dismiss()
                val isValid = result?.valid ?: false
                if (isValid) {
                    showToast("Device key is valid")
                    PreferencesManager.put(deviceKey, "device_key")

                    val device = result?.device
                    if (device?.company_id != null) {
                        PreferencesManager.put(device.company_id, Constants.PREF_COMPANY_ID)
                    }
                    if (device?.group_id != null) {
                        PreferencesManager.put(device.group_id, Constants.PREF_GROUP_ID)
                    }

                    val placeholderLogoUrl = result?.company?.placeholderLogoUrl
                    if (!placeholderLogoUrl.isNullOrBlank()) {
                        PreferencesManager.put(placeholderLogoUrl, Constants.PREF_PLACEHOLDER_LOGO_URL)
                    }

                    val companyId = device?.company_id
                    val groupId = device?.group_id
                    if (companyId != null && groupId != null) {
                        val topic = "c_${companyId}_g_${groupId}"
                        PreferencesManager.put(topic, Constants.PREF_FCM_TOPIC)
                        FirebaseMessaging.getInstance()
                            .subscribeToTopic(topic)
                            .addOnCompleteListener { task ->
                                Log.d("SetupDeviceFragment", "subscribeToTopic($topic) success=${task.isSuccessful}")
                            }

                        // Company-wide topic used for "All devices" group actions.
                        val companyTopic = "c_${companyId}_all"
                        FirebaseMessaging.getInstance()
                            .subscribeToTopic(companyTopic)
                            .addOnCompleteListener { task ->
                                Log.d("SetupDeviceFragment", "subscribeToTopic($companyTopic) success=${task.isSuccessful}")
                            }
                    }

                    (requireActivity() as MainActivity).replaceFragment(HomeFragment(),false)
                } else {
                    showToast("Invalid device key")
                }
            }

            deviceValidationError.observe(viewLifecycleOwner) { error ->
                loadingDialog?.dismiss()
                error?.let {
                    showToast("Error validating device key: $it")
                }
            }
        }

        binding.btnSubmit.setOnClickListener {
            hideKeyboard()
            val rawBaseUrl = binding.etBaseUrl.text?.toString()
            val normalizedBaseUrl = Constants.normalizeBaseUrl(rawBaseUrl)
            if (normalizedBaseUrl == null) {
                showToast("Invalid Base API URL. Must start with http:// or https://")
                return@setOnClickListener
            }
            PreferencesManager.put(normalizedBaseUrl, Constants.PREF_BASE_API_URL)

            deviceKey = binding.etDeviceKey.text.toString().trim()

            if (deviceKey.isEmpty()) {
                showToast("Please enter device key")
                return@setOnClickListener
            }

            showLoading()
            viewModel.validateDeviceKey(deviceKey)
        }
    }

    private fun showLoading() {
        if (loadingDialog?.isShowing == true) return

        val dialog = AlertDialog.Builder(requireContext())
            .setTitle("Please wait")
            .setMessage("Validating device key…")
            .setCancelable(true)
            .setNegativeButton("Cancel") { d, _ ->
                viewModel.cancelValidateDeviceKey()
                d.dismiss()
            }
            .create()

        dialog.setOnCancelListener {
            viewModel.cancelValidateDeviceKey()
        }

        loadingDialog = dialog
        dialog.show()
    }

    private fun hideKeyboard() {
        val imm = requireContext().getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
        imm.hideSoftInputFromWindow(binding.root.windowToken, 0)
        binding.root.clearFocus()
    }

    override fun onDestroyView() {
        loadingDialog?.dismiss()
        loadingDialog = null
        super.onDestroyView()
    }
}