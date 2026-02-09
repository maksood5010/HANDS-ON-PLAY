package com.hoi.player.utils

import android.app.Activity
import android.app.AlarmManager
import android.app.PendingIntent
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.UserManager
import android.util.Log
import com.hoi.player.MainActivity
import java.io.BufferedReader
import java.io.DataOutputStream
import java.io.InputStreamReader
import kotlin.system.exitProcess

class KioskUtil {
    companion object {
        val TAG = this.javaClass.simpleName
        fun setDeviceOwner(context: Activity){
            //dpm set-device-owner com.hoi.player/.utils.MyDeviceAdminReceiver
            adbCommand("dpm set-device-owner ${context.packageName}/.utils.MyDeviceAdminReceiver")
            startKioskMode(context)
//            setFont()

        }
        fun setFont(){
            val result= adbCommand("settings get system font_scale")?.trim()
            if (result!="1.3"){
                adbCommand("settings put system font_scale 1.3")
            }
        }
//        fun removeDeviceOwner(context: Activity){
//            //dpm remove-active-admin ${context.packageName}/.utils.MyDeviceAdminReceiver
////            adbCommand("dpm remove-active-admin ${context.packageName}/.utils.MyDeviceAdminReceiver")
//            // adb shell settings put system font_scale 1.3
//            Log.d(TAG, "removeDeviceOwner: context: Activity")
//            val devicePolicyManager =
//                context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
//            val myDeviceAdmin = ComponentName(context, MyDeviceAdminReceiver::class.java)
//            if (devicePolicyManager.isDeviceOwnerApp(context.packageName)){
//                devicePolicyManager.clearDeviceOwnerApp(context.packageName)
//            }
//            stopKioskMode(context)
//        }
        fun removeDeviceOwner(context: Context){
            Log.d(TAG, "removeDeviceOwner: context: Context")
            val devicePolicyManager =
                context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            if (devicePolicyManager.isDeviceOwnerApp(context.packageName)){
                devicePolicyManager.clearDeviceOwnerApp(context.packageName)
            }
            
//            // Stop the foreground service when removing device owner
//            try {
//                val serviceIntent = Intent(context, ${context.packageName}.service.MyForegroundService::class.java)
//                context.stopService(serviceIntent)
//                Log.d(TAG, "removeDeviceOwner: Foreground service stopped via Context")
//            } catch (e: Exception) {
//                Log.e(TAG, "removeDeviceOwner: Failed to stop foreground service", e)
//            }
        }

        fun startKioskMode(context: Activity) {
            val devicePolicyManager =
                context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            val myDeviceAdmin = ComponentName(context, MyDeviceAdminReceiver::class.java)
            if (devicePolicyManager.isDeviceOwnerApp(context.packageName)) {
                val filter = IntentFilter(Intent.ACTION_MAIN)
                filter.addCategory(Intent.CATEGORY_HOME)
                filter.addCategory(Intent.CATEGORY_DEFAULT)
                val activity = ComponentName(context, MainActivity::class.java)
                devicePolicyManager.addPersistentPreferredActivity(myDeviceAdmin, filter, activity)
                val appsWhiteList = arrayOf(context.packageName)
                devicePolicyManager.setLockTaskPackages(myDeviceAdmin, appsWhiteList)

                devicePolicyManager.addUserRestriction(
                    myDeviceAdmin, UserManager.DISALLOW_UNINSTALL_APPS
                )
                devicePolicyManager.setStatusBarDisabled(myDeviceAdmin, false)
                Log.d("TAG", "startKioskMode: This App set as an Owner device")

            } else {
//                Toast.info(context,"Info","This App is not an Owner device")
                Log.d("TAG", "startKioskMode: This App is not an Owner device")
            }
        }

        fun stopKioskMode(context: Activity) {
            val devicePolicyManager =
                context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            val myDeviceAdmin = ComponentName(context, MyDeviceAdminReceiver::class.java)
            if (devicePolicyManager.isAdminActive(myDeviceAdmin)) {
                context.stopLockTask()
            }
            if (devicePolicyManager.isDeviceOwnerApp(context.packageName)) {
                devicePolicyManager.clearUserRestriction(
                    myDeviceAdmin, UserManager.DISALLOW_UNINSTALL_APPS
                )
            }
            
            // Stop the foreground service when exiting kiosk mode
//            try {
//                val serviceIntent = Intent(context, com.hoi.player.service.MyForegroundService::class.java)
//                context.stopService(serviceIntent)
//                Log.d(TAG, "stopKioskMode: Foreground service stopped")
//            } catch (e: Exception) {
//                Log.e(TAG, "stopKioskMode: Failed to stop foreground service", e)
//            }
        }
        /*fun install(context: Context, apkFile: File) {
            val packageInstaller = context.packageManager.packageInstaller

            val inputStream = FileInputStream(apkFile)
            val packageName = context.packageName

            val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL)
            val sessionId = packageInstaller.createSession(params)
            val session = packageInstaller.openSession(sessionId)

            val out = session.openWrite("app_install", 0, apkFile.length())
            inputStream.copyTo(out)
            session.fsync(out)
            out.close()
            inputStream.close()
            Log.d(TAG, "install: launching InstallResultReceiver now")

            try{
                val intent = Intent(context, InstallResultReceiver::class.java)
                val pendingIntent = PendingIntent.getBroadcast(
                    context,
                    1,
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
                )

                session.commit(pendingIntent.intentSender)
                session.close()
            }catch (e: Exception){
                adbCommand("reboot")
                e.printStackTrace()
            }
        }*/
        fun restartApp(context: Context) {
            val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)
            intent?.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_NEW_TASK)

            val pendingIntent = PendingIntent.getActivity(
                context,
                0,
                intent,
                PendingIntent.FLAG_CANCEL_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            alarmManager.set(
                AlarmManager.RTC,
                System.currentTimeMillis() + 100,
                pendingIntent
            )

            exitProcess(0)
        }
        fun adbCommand(command: String): String? {
            Log.d(TAG, "adbCommand: $command")
            var process: Process? = null
            var os: DataOutputStream? = null
            var excresult = ""
            try {
                process = Runtime.getRuntime().exec("su")
                os = DataOutputStream(process.outputStream)
                os.writeBytes(
                    """
                $command

                """.trimIndent()
                )
                os.writeBytes("exit\n")
                os.flush()
                val `in` = BufferedReader(InputStreamReader(process.inputStream))
                val stringBuffer = StringBuffer()
                var line: String? = null
                while (`in`.readLine().also { line = it } != null) {
                    stringBuffer.append("$line ")
                }
                excresult = stringBuffer.toString()
                Log.d("Maksood ADB Commands", excresult)
                os.close()
                // System.out.println(excresult);
            } catch (e: Exception) {
                e.printStackTrace()
            }
            return excresult
        }

    }


}