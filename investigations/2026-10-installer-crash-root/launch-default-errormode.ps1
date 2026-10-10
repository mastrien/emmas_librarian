# Starts a command line with CREATE_DEFAULT_ERROR_MODE and waits, printing nothing and exiting with its exit code.
# A child of Node inherits error mode 32771 (SEM_NOGPFAULTERRORBOX included), so a crash never reaches Windows Error
# Reporting: no event, no dump. SetErrorMode(0) in the parent does not change that (checked locally); this flag does
# (child error mode 0). Usage: pwsh -NoProfile -File launch-default-errormode.ps1 -CommandLine '"C:\x\setup.exe" /S /D=C:\y'
param([Parameter(Mandatory = $true)][string]$CommandLine)

Add-Type -TypeDefinition @"
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;

public static class DefaultErrorModeLauncher {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)] struct STARTUPINFO {
    public int cb; public string lpReserved, lpDesktop, lpTitle;
    public int dwX, dwY, dwXSize, dwYSize, dwXCountChars, dwYCountChars, dwFillAttribute, dwFlags;
    public short wShowWindow, cbReserved2; public IntPtr lpReserved2, hStdInput, hStdOutput, hStdError;
  }
  [StructLayout(LayoutKind.Sequential)] struct PROCESS_INFORMATION { public IntPtr hProcess, hThread; public int dwProcessId, dwThreadId; }
  [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)] static extern bool CreateProcessW(string app, string cmd, IntPtr pa, IntPtr ta, bool inherit, uint flags, IntPtr env, string cwd, ref STARTUPINFO si, out PROCESS_INFORMATION pi);
  [DllImport("kernel32.dll")] static extern uint WaitForSingleObject(IntPtr handle, uint ms);
  [DllImport("kernel32.dll")] static extern bool GetExitCodeProcess(IntPtr handle, out uint code);

  const uint CREATE_DEFAULT_ERROR_MODE = 0x04000000, INFINITE = 0xFFFFFFFF;

  public static int Run(string commandLine) {
    var si = new STARTUPINFO(); si.cb = Marshal.SizeOf(si);
    PROCESS_INFORMATION pi;
    if (!CreateProcessW(null, commandLine, IntPtr.Zero, IntPtr.Zero, true, CREATE_DEFAULT_ERROR_MODE, IntPtr.Zero, null, ref si, out pi))
      throw new Win32Exception(Marshal.GetLastWin32Error(), "CreateProcessW failed for: " + commandLine);
    WaitForSingleObject(pi.hProcess, INFINITE);
    uint code; GetExitCodeProcess(pi.hProcess, out code);
    return unchecked((int)code);
  }
}
"@

exit ([DefaultErrorModeLauncher]::Run($CommandLine))
