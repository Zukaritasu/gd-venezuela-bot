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


#pragma once

#include <openssl/evp.h>

#include <string>
#include <string_view>

inline std::string base64Encode(std::string_view input) {
    if (input.empty())
        return {};

    std::string output(4 * ((input.size() + 2) / 3), '\0');
    const int written = EVP_EncodeBlock(
        reinterpret_cast<unsigned char*>(output.data()),
        reinterpret_cast<const unsigned char*>(input.data()),
        static_cast<int>(input.size()));

    output.resize(static_cast<std::size_t>(written));
    return output;
}