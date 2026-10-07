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

#include <curl/curl.h>
#include <nlohmann/json.hpp>

#include <algorithm>
#include <iostream>
#include <cctype>
#include <chrono>
#include <thread>

namespace {

constexpr const char* kEndpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent";
constexpr const char* kUserAgent = "gscan/1.0";
constexpr int kMaxAttempts = 3;

constexpr const char* kPrompt =
    "Analiza estas 4 imagenes. Responde SOLO con un numero entero de 1 a 100, "
    "donde 1 = imagenes legitimas y 100 = con total certeza estafa de criptomonedas.";

std::size_t writeCallback(char* data, std::size_t size, std::size_t count, void* userdata) {
    static_cast<std::string*>(userdata)->append(data, size * count);
    return size * count;
}

std::string buildRequestBody(const std::vector<ImagePayload>& images) {
    nlohmann::json parts = nlohmann::json::array();
    parts.push_back({{"text", kPrompt}});

    for (const ImagePayload& image : images) {
        const nlohmann::json blob = {
            {"mime_type", image.mimeType},
            {"data", image.base64},
        };
        parts.push_back({{"inline_data", blob}});
    }

    const nlohmann::json content = {{"parts", std::move(parts)}};
    
    const nlohmann::json body = {
        {"contents", nlohmann::json::array({content})},
        {"generationConfig", {
            {"thinkingConfig", {
                {"thinkingBudget", 0}
            }}
        }}
    };

    return body.dump();
}

std::string extractText(const std::string& raw) {
    nlohmann::json document;
    try {
        document = nlohmann::json::parse(raw);
    } catch (const nlohmann::json::exception&) {
        return {};
    }

    if (!document.is_object())
        return {};

    const nlohmann::json candidates = document.value("candidates", nlohmann::json::array());
    if (!candidates.is_array() || candidates.empty())
        return {};

    const nlohmann::json content = candidates.front().value("content", nlohmann::json::object());
    const nlohmann::json parts = content.value("parts", nlohmann::json::array());
    if (!parts.is_array())
        return {};

    std::string text;
    for (const nlohmann::json& part : parts) {
        const auto value = part.find("text");
        if (value != part.end() && value->is_string())
            text += value->get<std::string>();
    }

    return text;
}

bool parseScore(const std::string& text, int& score) {
    auto it = std::find_if(text.begin(), text.end(), [](unsigned char character) {
        return std::isdigit(character) != 0;
    });
    if (it == text.end())
        return false;

    int value = 0;
    for (int digits = 0; it != text.end() && digits < 3; ++digits, ++it) {
        if (std::isdigit(static_cast<unsigned char>(*it)) == 0)
            break;
        value = value * 10 + (*it - '0');
    }

    score = std::clamp(value, 1, 100);
    return true;
}

std::string describeError(const std::string& body) {
    nlohmann::json document;
    try {
        document = nlohmann::json::parse(body);
    } catch (const nlohmann::json::exception&) {
        return body.substr(0, 200);
    }

    const auto error = document.find("error");
    if (error != document.end() && error->is_object()) {
        const auto message = error->find("message");
        if (message != error->end() && message->is_string())
            return message->get<std::string>();
    }

    const auto message = document.find("message");
    if (message != document.end() && message->is_string())
        return message->get<std::string>();

    return body.substr(0, 200);
}

struct HttpResponse {
    bool ok;
    long status;
    std::string body;
};

HttpResponse post(const std::string& apiKey, const std::string& requestBody) {
    CURL* handle = curl_easy_init();
    if (handle == nullptr)
        return {false, 0, "No se pudo iniciar el cliente HTTP."};

    curl_slist* headers = nullptr;
    headers = curl_slist_append(headers, "Content-Type: application/json");
    const std::string apiKeyHeader = "x-goog-api-key: " + apiKey;
    headers = curl_slist_append(headers, apiKeyHeader.c_str());

    std::string responseBody;
    curl_easy_setopt(handle, CURLOPT_URL, kEndpoint);
    curl_easy_setopt(handle, CURLOPT_HTTPHEADER, headers);
    curl_easy_setopt(handle, CURLOPT_POSTFIELDS, requestBody.c_str());
    curl_easy_setopt(handle, CURLOPT_POSTFIELDSIZE, static_cast<long>(requestBody.size()));
    curl_easy_setopt(handle, CURLOPT_USERAGENT, kUserAgent);
    curl_easy_setopt(handle, CURLOPT_WRITEFUNCTION, writeCallback);
    curl_easy_setopt(handle, CURLOPT_WRITEDATA, &responseBody);
    curl_easy_setopt(handle, CURLOPT_ACCEPT_ENCODING, "");
    curl_easy_setopt(handle, CURLOPT_TIMEOUT, 120L);
    curl_easy_setopt(handle, CURLOPT_CONNECTTIMEOUT, 15L);

    const CURLcode code = curl_easy_perform(handle);

    long status = 0;
    curl_easy_getinfo(handle, CURLINFO_RESPONSE_CODE, &status);

    curl_slist_free_all(headers);
    curl_easy_cleanup(handle);

    if (code != CURLE_OK)
        return {false, status, std::string("No se pudo conectar con el servicio: ") + curl_easy_strerror(code)};

    return {true, status, std::move(responseBody)};
}

bool isRetryable(long status) {
    return status == 429 || status >= 500;
}

std::string httpErrorMessage(const HttpResponse& response) {
    return "El servicio respondio con error " + std::to_string(response.status) + ": " + describeError(response.body);
}

ApiResult scoreFromBody(const std::string& body) {
    int score = 0;
    if (!parseScore(extractText(body), score))
        return {false, 0, "El servicio no devolvio una puntuacion valida."};
    return {true, score, {}};
}

}

ApiResult analyzeImages(const std::string& apiKey, const std::vector<ImagePayload>& images) {
    if (apiKey.empty())
        return {false, 0, "La clave de API esta vacia."};

    curl_global_init(CURL_GLOBAL_DEFAULT);

    const std::string requestBody = buildRequestBody(images);

    for (int attempt = 1; attempt <= kMaxAttempts; ++attempt) {
        const HttpResponse response = post(apiKey, requestBody);

        if (!response.ok)
            return {false, 0, response.body};

        if (response.status == 200)
            return scoreFromBody(response.body);

        if (!isRetryable(response.status))
            return {false, 0, httpErrorMessage(response)};

        if (attempt == kMaxAttempts)
            return {false, 0, httpErrorMessage(response)};

        std::this_thread::sleep_for(std::chrono::seconds(attempt));
    }

    return {false, 0, "No se pudo obtener una respuesta del servicio."};
}