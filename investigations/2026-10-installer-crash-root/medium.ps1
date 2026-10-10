# Starts a command line with the current user's UAC-filtered token at Medium integrity and waits for it.
# "runas /trustlevel" did not lower the token on the runners (the process stayed High), so this builds the token
# itself: CreateRestrictedToken(LUA_TOKEN) is what UAC hands a non-elevated session (Administrators deny-only,
# privileges stripped), then the integrity label is set to Medium (S-1-16-8192).
# Usage: powershell -File medium.ps1 -CommandLine 'cmd.exe /c "C:\work\run.cmd"'   (prints the process exit code)
param([Parameter(Mandatory = $true)][string]$CommandLine)

Add-Type -TypeDefinition @"
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;

public static class MediumLauncher {
  [StructLayout(LayoutKind.Sequential)] struct SID_AND_ATTRIBUTES { public IntPtr Sid; public uint Attributes; }
  [StructLayout(LayoutKind.Sequential)] struct TOKEN_MANDATORY_LABEL { public SID_AND_ATTRIBUTES Label; }
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)] struct STARTUPINFO {
    public int cb; public string lpReserved; public string lpDesktop; public string lpTitle;
    public int dwX, dwY, dwXSize, dwYSize, dwXCountChars, dwYCountChars, dwFillAttribute, dwFlags;
    public short wShowWindow, cbReserved2; public IntPtr lpReserved2, hStdInput, hStdOutput, hStdError;
  }
  [StructLayout(LayoutKind.Sequential)] struct PROCESS_INFORMATION { public IntPtr hProcess, hThread; public int dwProcessId, dwThreadId; }

  [DllImport("advapi32.dll", SetLastError = true)] static extern bool OpenProcessToken(IntPtr p, uint access, out IntPtr token);
  [DllImport("advapi32.dll", SetLastError = true)] static extern bool CreateRestrictedToken(IntPtr token, uint flags, uint nDisable, IntPtr disable, uint nDelete, IntPtr del, uint nRestrict, IntPtr restrict, out IntPtr newToken);
  [DllImport("advapi32.dll", SetLastError = true)] static extern bool SetTokenInformation(IntPtr token, int infoClass, IntPtr info, int length);
  [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)] static extern bool ConvertStringSidToSid(string s, out IntPtr sid);
  [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)] static extern bool CreateProcessWithTokenW(IntPtr token, uint logon, string app, string cmd, uint flags, IntPtr env, string cwd, ref STARTUPINFO si, out PROCESS_INFORMATION pi);
  [DllImport("advapi32.dll", SetLastError = true)] static extern bool DuplicateTokenEx(IntPtr token, uint access, IntPtr attributes, int impersonationLevel, int tokenType, out IntPtr newToken);
  [DllImport("advapi32.dll")] static extern uint GetLengthSid(IntPtr sid);
  [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
  [DllImport("kernel32.dll", SetLastError = true)] static extern uint WaitForSingleObject(IntPtr handle, uint ms);
  [DllImport("kernel32.dll", SetLastError = true)] static extern bool GetExitCodeProcess(IntPtr handle, out uint code);

  const uint TOKEN_ASSIGN_PRIMARY = 0x1, TOKEN_DUPLICATE = 0x2, TOKEN_QUERY = 0x8, LUA_TOKEN = 0x4, SE_GROUP_INTEGRITY = 0x20;
  const int TokenIntegrityLevel = 25, SecurityImpersonation = 2, TokenPrimary = 1;
  const uint MAXIMUM_ALLOWED = 0x02000000;

  static void Check(bool ok, string what) {
    if (ok) return;
    int error = Marshal.GetLastWin32Error();
    throw new Win32Exception(error, what + " failed with Win32 error " + error);
  }

  static IntPtr MediumToken() {
    IntPtr own, restricted, filtered, sid;
    Check(OpenProcessToken(GetCurrentProcess(), TOKEN_ASSIGN_PRIMARY | TOKEN_DUPLICATE | TOKEN_QUERY, out own), "OpenProcessToken");
    Check(CreateRestrictedToken(own, LUA_TOKEN, 0, IntPtr.Zero, 0, IntPtr.Zero, 0, IntPtr.Zero, out restricted), "CreateRestrictedToken(LUA_TOKEN)");
    // The handle CreateRestrictedToken returns cannot be adjusted (error 5): a duplicate with full access can.
    Check(DuplicateTokenEx(restricted, MAXIMUM_ALLOWED, IntPtr.Zero, SecurityImpersonation, TokenPrimary, out filtered), "DuplicateTokenEx");
    Check(ConvertStringSidToSid("S-1-16-8192", out sid), "ConvertStringSidToSid(medium)");
    var label = new TOKEN_MANDATORY_LABEL { Label = new SID_AND_ATTRIBUTES { Sid = sid, Attributes = SE_GROUP_INTEGRITY } };
    // The documented length is the structure plus the SID it points to (GetLengthSid), not the structure alone.
    int size = Marshal.SizeOf(label) + (int)GetLengthSid(sid);
    IntPtr buffer = Marshal.AllocHGlobal(size);
    Marshal.StructureToPtr(label, buffer, false);
    Check(SetTokenInformation(filtered, TokenIntegrityLevel, buffer, size), "SetTokenInformation(integrity)");
    return filtered;
  }

  public static uint Run(string commandLine, uint timeoutMs) {
    var si = new STARTUPINFO(); si.cb = Marshal.SizeOf(si);
    PROCESS_INFORMATION pi;
    Check(CreateProcessWithTokenW(MediumToken(), 0, null, commandLine, 0, IntPtr.Zero, null, ref si, out pi), "CreateProcessWithTokenW");
    uint code;
    if (WaitForSingleObject(pi.hProcess, timeoutMs) != 0) throw new TimeoutException("Medium-integrity process did not exit in " + timeoutMs + " ms: " + commandLine);
    Check(GetExitCodeProcess(pi.hProcess, out code), "GetExitCodeProcess");
    return code;
  }
}
"@

[MediumLauncher]::Run($CommandLine, 300000)
