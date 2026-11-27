class Nightglide < Formula
  desc "Terminal AI coding agent CLI (built on Oh My Pi)"
  homepage "https://github.com/Aoody743/nightglide-cli"
  version "1.0.0"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/Aoody743/nightglide-cli/releases/download/v1.0.0/nightglide-v1.0.0-darwin-arm64.tar.gz"
      sha256 "06a573afff78b4d6e146709f2fd0dfb61874852ee9072e08c09bc8c15c54feb3"
    end

    on_intel do
      url "https://github.com/Aoody743/nightglide-cli/releases/download/v1.0.0/nightglide-v1.0.0-darwin-x64.tar.gz"
      sha256 "c41cc2bd12f6263cfb21c2b37d0e0bfc9f5dbbf6f4595452b5ebf8f12f604b21"
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/Aoody743/nightglide-cli/releases/download/v1.0.0/nightglide-v1.0.0-linux-arm64.tar.gz"
      sha256 "105fc14cb5550ee02f01cdfcbd524e20eeb2c648b8ecc17fd767cd3accaefb76"
    end

    on_intel do
      url "https://github.com/Aoody743/nightglide-cli/releases/download/v1.0.0/nightglide-v1.0.0-linux-x64.tar.gz"
      sha256 "79adee04b939f8cadb5df365bbb287b276dc926b978c8e8132c827448ae63393"
    end
  end

  def install
    bin.install "nightglide"
    prefix.install "LICENSE"
    prefix.install "THIRD-PARTY-NOTICES.txt"
    prefix.install "README.md" if File.exist?("README.md")
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/nightglide --version")
  end
end
