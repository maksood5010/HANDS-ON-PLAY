package com.hoi.player.fragment

import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.viewpager2.widget.ViewPager2
import com.hoi.player.adapter.PlaylistPagerAdapter
import com.hoi.player.databinding.FragmentHomeBinding
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

    private lateinit var adapter: PlaylistPagerAdapter

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        deviceKey = PreferencesManager.get<String>("device_key")
        if (deviceKey == null) {
            Log.e("HomeFragment", "No device key found")
            return
        }

        adapter = PlaylistPagerAdapter(
            onVideoEnded = { advanceToNext() },
            onVideoError = {
                handler.postDelayed({ advanceToNext() }, 2000)
            }
        )

        binding.viewPager.adapter = adapter
        binding.viewPager.registerOnPageChangeCallback(object : ViewPager2.OnPageChangeCallback() {
            override fun onPageSelected(position: Int) {
                super.onPageSelected(position)
                handler.removeCallbacks(advanceRunnable)
                adapter.currentPosition = position
                startAdvanceForPosition(position)
            }
        })

        viewModel.playlistResult.observe(viewLifecycleOwner) { result ->
            result?.playlist?.items?.let { items ->
                val sortedItems = items.sortedBy { it.displayOrder ?: Int.MAX_VALUE }
                adapter.submitList(sortedItems)
                binding.viewPager.setCurrentItem(0, false)
                adapter.currentPosition = 0
                if (sortedItems.isNotEmpty()) {
                    startAdvanceForPosition(0)
                }
            }
        }

        viewModel.playlistError.observe(viewLifecycleOwner) { error ->
            error?.let {
                Log.e("HomeFragment", "Playlist error: $it")
                if (adapter.itemCount > 0) {
                    binding.viewPager.setCurrentItem(0, false)
                    adapter.currentPosition = 0
                    startAdvanceForPosition(0)
                    handler.postDelayed({
                        deviceKey?.let { key -> viewModel.fetchPlaylist(key) }
                    }, 30_000)
                }
            }
        }

        viewModel.startHeartbeat(deviceKey!!)
        viewModel.fetchPlaylist(deviceKey!!)
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
        binding.viewPager.adapter = null
        viewModel.stopHeartbeat()
        super.onDestroyView()
    }
}
