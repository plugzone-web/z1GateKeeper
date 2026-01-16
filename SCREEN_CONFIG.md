# GNU Screen Configuration

## Overview

GNU Screen functionality is now **optional** in z1GateKeeper. By default, it's disabled to avoid TTY signal issues and simplify the setup.

## Configuration

In your `config.json`, you can control Screen behavior:

### Disable Screen (Recommended)

```json
{
  "screen": {
    "enabled": false
  }
}
```

**Benefits:**
- ✅ No TTY signal issues
- ✅ Simpler setup (no Screen installation required)
- ✅ Direct shell access
- ✅ Faster connection initialization
- ✅ Better compatibility with various SSH clients

### Enable Screen

```json
{
  "screen": {
    "enabled": true,
    "sessionName": "IA_BATCH_WORKSPACE"
  }
}
```

**When to use:**
- You need persistent sessions that survive disconnections
- You want to manually attach to sessions for monitoring
- You have specific requirements for session persistence

**Requirements:**
- GNU Screen must be installed on the destination server
- Screen must be accessible in the PATH

## Default Behavior

- **If `enabled` is not specified**: Screen is **disabled** (default: `false`)
- **If `enabled: true`**: Screen session will be created
- **If `enabled: false`**: Direct shell access without Screen

## Migration

If you're upgrading from an older version:

1. **Screen was previously always enabled**
2. **Now you must explicitly enable it** if you want it
3. **Default is disabled** to avoid TTY issues

To keep the old behavior, add to your `config.json`:

```json
{
  "screen": {
    "enabled": true,
    "sessionName": "IA_BATCH_WORKSPACE"
  }
}
```

## Troubleshooting

### TTY Signal Issues

If you experience TTY signal problems or connection issues:
- Set `"enabled": false` in the screen configuration
- This will use direct shell access without Screen

### Screen Not Found

If Screen is enabled but not installed:
- Install Screen: `sudo apt-get install screen` (Ubuntu/Debian)
- Or disable Screen: `"enabled": false`

### Connection Hangs

If connections hang during initialization:
- Disable Screen: `"enabled": false`
- This removes the Screen initialization delay
