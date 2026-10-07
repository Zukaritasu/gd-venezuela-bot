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

#include <vector>
#include <iostream>

int main(int argc, char* argv[]) {
    // arg[0] = gscan
    // arg[1] = api_key
    // arg[2] = image1
    // arg[3] = image2
    // arg[4] = image3
    // arg[5] = image4

    if (argc < 3 || argc > 6) {
        std::cerr << "Uso: gscan <api_key> <imagen1>... <imagen4>\nv1.3.0\n";
        return 1;
    }

    const std::string apiKey = argv[1];

    std::vector<ImagePayload> images;
    for (int i = 2, j = 0; i < argc; ++i) {
        const std::string path = argv[i];
        
        images.emplace_back();
        if (mimeTypeFromPath(path).empty()) {
            std::cerr << "Formato de imagen no soportado: " << path << '\n';
            return 1;
        }

        if (!loadImage(path, images[j])) {
            std::cerr << "No se pudo leer la imagen: " << path << '\n';
            return 1;
        }

        ++j;
    }

    const ApiResult result = analyzeImages(apiKey, images);
    if (!result.ok) {
        std::cerr << result.error << '\n';
        return 1;
    }

    std::cout << result.score << '\n';
    return 0;
}