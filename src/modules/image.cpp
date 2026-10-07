/**
 * Copyright (C) 2026 Zukaritasu
 * Authors: NingJjwo <ixxjuandavidgxxi@gmail.com>
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */


#include "image.hpp"

#include "base64.hpp"

#include <cctype>
#include <fstream>

namespace {

std::string extensionOf(std::string_view path) {
    const std::size_t dot = path.find_last_of('.');
    const std::size_t separator = path.find_last_of("/\\");

    if (dot == std::string_view::npos)
        return {};
    if (separator != std::string_view::npos && dot < separator)
        return {};

    std::string extension(path.substr(dot + 1));
    for (char& character : extension)
        character = static_cast<char>(std::tolower(static_cast<unsigned char>(character)));

    return extension;
}

}

std::string mimeTypeFromPath(std::string_view path) {
    const std::string extension = extensionOf(path);

    if (extension == "png")
        return "image/png";
    if (extension == "jpg" || extension == "jpeg")
        return "image/jpeg";
    if (extension == "webp")
        return "image/webp";
    if (extension == "gif")
        return "image/gif";
    if (extension == "bmp")
        return "image/bmp";
    if (extension == "heic" || extension == "heif")
        return "image/heic";

    return {};
}

bool readFileBinary(const std::string& path, std::string& out) {
    std::ifstream file(path, std::ios::binary);
    if (!file)
        return false;

    file.seekg(0, std::ios::end);
    const std::streamoff size = file.tellg();
    if (size <= 0)
        return false;

    file.seekg(0, std::ios::beg);
    out.resize(static_cast<std::size_t>(size));
    file.read(out.data(), size);

    return file.gcount() == size;
}

bool loadImage(const std::string& path, ImagePayload& out) {
    const std::string mimeType = mimeTypeFromPath(path);
    if (mimeType.empty())
        return false;

    std::string bytes;
    if (!readFileBinary(path, bytes))
        return false;

    out.path = path;
    out.mimeType = mimeType;
    out.base64 = base64Encode(bytes);

    return true;
}