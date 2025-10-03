set -e

# Download and import OpenWrt public key for verifying builds
curl -fsSL --retry 3 --retry-delay 2 \
    "https://git.openwrt.org/?p=keyring.git;a=blob_plain;f=gpg/0x1D53D1877742E911.asc" \
    | gpg --batch --import

# Mark the key as fully trusted by its official fingerprint
echo "8A8BC12F46B836C0F9CDB36F1D53D1877742E911:6:" | gpg --batch --import-ownertrust

# the inputs:
TARGET="${TARGET:-x86/64}"
VERSION_PATH="${VERSION_PATH:-snapshots}"
FILE_HOST="${UPSTREAM_URL:-${FILE_HOST:-https://downloads.openwrt.org}}"
DOWNLOAD_FILE="${DOWNLOAD_FILE:-imagebuilder-.*x86_64.tar.[xz|zst]}"
DOWNLOAD_PATH="$VERSION_PATH/targets/$TARGET"

wget -nv "$FILE_HOST/$DOWNLOAD_PATH/sha256sums" -O sha256sums
wget -nv "$FILE_HOST/$DOWNLOAD_PATH/sha256sums.asc" -O sha256sums.asc

# gpg --import /builder/keys/*.asc && rm -rf /builder/keys/
gpg --with-fingerprint --verify sha256sums.asc sha256sums

# determine archive name
file_name="$(grep "$DOWNLOAD_FILE" sha256sums | cut -d "*" -f 2)"

# download imagebuilder/sdk archive
wget -nv "$FILE_HOST/$DOWNLOAD_PATH/$file_name"

# shrink checksum file to single desired file and verify downloaded archive
grep "$file_name" sha256sums > sha256sums_min
cat sha256sums_min
sha256sum -c sha256sums_min

# cleanup
# rm -vrf sha256sums{,_min,.asc} keys/

# tar xf "$file_name" --strip=1 --no-same-owner -C .
# rm -vrf "$file_name"
