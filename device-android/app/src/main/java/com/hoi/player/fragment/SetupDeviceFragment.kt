package com.hoi.player.fragment

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.lifecycle.Observer
import com.hoi.player.MainActivity
import com.hoi.player.databinding.FragmentSetupDeviceBinding
import com.hoi.player.utils.PreferencesManager
import com.hoi.player.viewmodel.MainViewModel

class SetupDeviceFragment : Fragment() {

    private val viewModel: MainViewModel by activityViewModels()
    val binding: FragmentSetupDeviceBinding by lazy {
        FragmentSetupDeviceBinding.inflate(layoutInflater)
    }
    var deviceKey =""

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

        with(viewModel) {
            deviceValidationResult.observe(viewLifecycleOwner) { result ->
                val isValid = result?.valid ?: false
                if (isValid) {
                    showToast("Device key is valid")
                    PreferencesManager.put(deviceKey, "device_key")
                    (requireActivity() as MainActivity).replaceFragment(HomeFragment(),false)
                } else {
                    showToast("Invalid device key")
                }
            }

            deviceValidationError.observe(viewLifecycleOwner) { error ->
                error?.let {
                    showToast("Error validating device key: $it")
                }
            }
        }

        binding.btnSubmit.setOnClickListener {
            deviceKey = binding.etDeviceKey.text.toString().trim()

            if (deviceKey.isEmpty()) {
                showToast("Please enter device key")
                return@setOnClickListener
            }

            viewModel.validateDeviceKey(deviceKey)
        }
    }
}