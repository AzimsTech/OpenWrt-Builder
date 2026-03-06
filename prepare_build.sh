#!/bin/bash
# scripts/prepare_build.sh

# Exit immediately if a command exits with a non-zero status
set -e

UCI_DIR="files/etc/uci-defaults"
SELECTED_SCRIPT="$1"
CUSTOM_SCRIPT_CONTENT="$2"

echo "=== Preparing Build Environment ==="

# 1. Handle "99-custom" script generation
if [ "$SELECTED_SCRIPT" = "99-custom" ]; then
    echo "Generating 99-custom script..."
    # Ensure directory exists
    mkdir -p "$UCI_DIR"
    
    # Write the custom content passed from the environment
    echo "$CUSTOM_SCRIPT_CONTENT" > "$UCI_DIR/99-custom"
    cat "$UCI_DIR/99-custom"
fi

# 2. Process UCI defaults directory (keep only the selected script)
if [ -n "$SELECTED_SCRIPT" ]; then
    if [ ! -f "$UCI_DIR/$SELECTED_SCRIPT" ]; then
        echo "Error: Script '$SELECTED_SCRIPT' not found in $UCI_DIR"
        exit 1
    fi
    
    echo "Cleaning up unselected scripts. Keeping: $SELECTED_SCRIPT"
    find "$UCI_DIR" -type f ! -name "$SELECTED_SCRIPT" -delete 2>/dev/null || true
    chmod +x "$UCI_DIR/$SELECTED_SCRIPT"
else
    echo "No script selected. Removing all UCI scripts."
    rm -f "$UCI_DIR"/* 2>/dev/null || true
fi

# 3. Inject Secrets (if a script is selected)
if [ -n "$SELECTED_SCRIPT" ] && [ -f "$UCI_DIR/$SELECTED_SCRIPT" ]; then
    echo "Injecting secrets into $SELECTED_SCRIPT..."
    
    # We use environment variables for secrets so they don't get logged in the command history
    sed -i \
        -e "s/^# ssid=\".*\"/ssid=\"${SECRET_WLAN_NAME}\"/" \
        -e "s/^# ssid_key=\".*\"/ssid_key=\"${SECRET_WLAN_PASS}\"/" \
        -e "s/^# root_password=\".*\"/root_password=\"${SECRET_ROOT_PASS}\"/" \
        -e "s/^# pppoe_name=\".*\"/pppoe_name=\"${SECRET_PPPOE_NAME}\"/" \
        -e "s/^# pppoe_key=\".*\"/pppoe_key=\"${SECRET_PPPOE_PASS}\"/" \
        "$UCI_DIR/$SELECTED_SCRIPT"
        
    echo "Secrets injected successfully."
fi

echo "=== Preparation Complete ==="