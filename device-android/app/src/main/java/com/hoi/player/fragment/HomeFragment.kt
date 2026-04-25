package com.hoi.player.fragment

import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.viewpager2.widget.ViewPager2
import androidx.core.content.ContextCompat
import kotlin.math.abs
import com.hoi.player.MainActivity
import com.hoi.player.adapter.PlaylistPagerAdapter
import com.hoi.player.databinding.FragmentHomeBinding
import com.hoi.player.utils.Constants
import com.hoi.player.utils.PreferencesManager
import com.hoi.player.viewmodel.MainViewModel

class HomeFragment : Fragment() {

    private val viewModel: MainViewModel by activityViewModels()

    private val binding: FragmentHomeBinding by lazy {
        FragmentHomeBinding.inflate(layoutInflater)
    }

    private var deviceKey: String? = null

    private val handler = Handler(Looper.getMainLooper())
    private val advanceRunnable = Runnable { advanceToNext() }
    private val hideErrorRunnable = Runnable { hideError() }

    private lateinit var adapter: PlaylistPagerAdapter

    private val refreshReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == Constants.ACTION_PLAYLIST_REFRESH) {
                deviceKey?.let { key -> viewModel.fetchPlaylist(key) }
            }
        }
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        binding.btnSettings.setOnClickListener {
            if (binding.placeholderImage.visibility == View.VISIBLE) {
                (requireActivity() as MainActivity).replaceFragment(SettingsFragment(), true)
            }
        }

        deviceKey = PreferencesManager.get<String>("device_key")
        if (deviceKey == null) {
            Log.e("HomeFragment", "No device key found")
            showError("Device not set up. Open settings and enter the device key.")
            updatePlaceholder(hasItems = false)
            return
        }

        adapter = PlaylistPagerAdapter(
            onVideoEnded = { advanceToNext() },
            onVideoError = {
                handler.postDelayed({ advanceToNext() }, 2000)
            }
        )

        binding.viewPager.adapter = adapter
        // Fade transition instead of vertical "scroll up" slide.
        binding.viewPager.setPageTransformer { page, position ->
            // position: 0 = centered, -1 = one page above, 1 = one page below
            val pageHeight = page.height.toFloat()
            // Cancel the default vertical slide so only alpha changes.
            page.translationY = -position * pageHeight
            page.alpha = 1f - abs(position).coerceIn(0f, 1f)
        }
        binding.viewPager.registerOnPageChangeCallback(object : ViewPager2.OnPageChangeCallback() {
            override fun onPageSelected(position: Int) {
                super.onPageSelected(position)
                handler.removeCallbacks(advanceRunnable)
                adapter.currentPosition = position
                startAdvanceForPosition(position)
            }
        })

        viewModel.playlistResult.observe(viewLifecycleOwner) { result ->
            val items = result?.playlist?.items
            val sortedItems = items
                ?.sortedBy { it.displayOrder ?: Int.MAX_VALUE }
                .orEmpty()

            adapter.submitList(sortedItems)
            adapter.onPlaylistRefreshed()
            updatePlaceholder(hasItems = sortedItems.isNotEmpty())
            hideError()

            if (sortedItems.isNotEmpty()) {
                binding.viewPager.setCurrentItem(0, false)
                adapter.currentPosition = 0
                startAdvanceForPosition(0)
            }
        }

        viewModel.playlistError.observe(viewLifecycleOwner) { error ->
            error?.let {
                Log.e("HomeFragment", "Playlist error: $it")
                showError("Can’t refresh content right now. Retrying in 30 seconds…")
                if (adapter.itemCount > 0) {
                    binding.viewPager.setCurrentItem(0, false)
                    adapter.currentPosition = 0
                    startAdvanceForPosition(0)
                    handler.postDelayed({
                        deviceKey?.let { key -> viewModel.fetchPlaylist(key) }
                    }, 30_000)
                } else {
                    updatePlaceholder(hasItems = false)
                }
            }
        }

        viewModel.heartbeatError.observe(viewLifecycleOwner) { error ->
            // Heartbeat is periodic; keep message friendly and non-spammy.
            if (!error.isNullOrBlank()) {
                Log.w("HomeFragment", "Heartbeat error: $error")
                showError("Connection issue. Trying again…")
            }
        }

        viewModel.startHeartbeat(deviceKey!!)
        viewModel.fetchPlaylist(deviceKey!!)
    }

    private fun updatePlaceholder(hasItems: Boolean) {
        binding.placeholderImage.visibility = if (hasItems) View.GONE else View.VISIBLE
        binding.viewPager.visibility = if (hasItems) View.VISIBLE else View.GONE
        binding.btnSettings.visibility = if (hasItems) View.GONE else View.VISIBLE
    }

    private fun startAdvanceForPosition(position: Int) {
        val items = adapter.currentList
        if (position >= items.size) return

        val item = items[position]
        val isVideo = item.fileType.equals("video", ignoreCase = true)

        if (isVideo) {
            // Video will call onVideoEnded when finished
        } else {
            val durationSeconds = (item.duration ?: 5).coerceAtLeast(1)
            handler.postDelayed(advanceRunnable, durationSeconds * 1000L)
        }
    }

    private fun advanceToNext() {
        handler.removeCallbacks(advanceRunnable)
        val current = binding.viewPager.currentItem
        val count = adapter.itemCount

        if (count == 0) return

        if (current < count - 1) {
            binding.viewPager.setCurrentItem(current + 1, true)
        } else {
            deviceKey?.let { viewModel.fetchPlaylist(it) }
        }
    }

    override fun onDestroyView() {
        handler.removeCallbacks(advanceRunnable)
        handler.removeCallbacks(hideErrorRunnable)
        binding.viewPager.adapter = null
        viewModel.stopHeartbeat()
        super.onDestroyView()
    }

    private fun showError(message: String) {
        handler.removeCallbacks(hideErrorRunnable)
        binding.tvError.text = message
        binding.tvError.visibility = View.VISIBLE
        // Auto-hide after a bit so it doesn't burn-in on TVs.
        handler.postDelayed(hideErrorRunnable, 12_000)
    }

    private fun hideError() {
        binding.tvError.visibility = View.GONE
    }

    override fun onStop() {
        try {
            requireContext().unregisterReceiver(refreshReceiver)
        } catch (_: Throwable) {
        }
        if (::adapter.isInitialized) {
            adapter.pausePlayback()
        }
        super.onStop()
    }

    override fun onStart() {
        super.onStart()
        ContextCompat.registerReceiver(
            requireContext(),
            refreshReceiver,
            IntentFilter(Constants.ACTION_PLAYLIST_REFRESH),
            ContextCompat.RECEIVER_NOT_EXPORTED
        )
    }
}
