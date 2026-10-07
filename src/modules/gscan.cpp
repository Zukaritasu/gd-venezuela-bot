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


#include "api.hpp"
#include "image.hpp"

#include <array>
#include <iostream>

int main(int argc, char* argv[]) {
    if (argc != 6) {
        std::cerr << "Uso: gscan <api_key> <imagen1> <imagen2> <imagen3> <imagen4>\n";
        return 1;
    }

    const std::string apiKey = argv[1];

    std::array<ImagePayload, 4> images;
    for (std::size_t index = 0; index < images.size(); ++index) {
        const std::string path = argv[index + 2];

        if (mimeTypeFromPath(path).empty()) {
            std::cerr << "Formato de imagen no soportado: " << path << '\n';
            return 1;
        }

        if (!loadImage(path, images[index])) {
            std::cerr << "No se pudo leer la imagen: " << path << '\n';
            return 1;
        }
    }

    const ApiResult result = analyzeImages(apiKey, images);
    if (!result.ok) {
        std::cerr << result.error << '\n';
        return 1;
    }

    std::cout << result.score << '\n';
    return 0;
}