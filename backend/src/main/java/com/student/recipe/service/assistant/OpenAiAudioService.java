package com.student.recipe.service.assistant;

import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;

@Service
public class OpenAiAudioService {

    private final WebClient webClient;

    public OpenAiAudioService(WebClient openAiAudioWebClient) {
        this.webClient = openAiAudioWebClient;
    }

    public String transcribe(MultipartFile audioFile) throws IOException {
        MultipartBodyBuilder builder = new MultipartBodyBuilder();

        builder.part("file", new ByteArrayResource(audioFile.getBytes()) {
            @Override
            public String getFilename() {
                return audioFile.getOriginalFilename() != null
                        ? audioFile.getOriginalFilename()
                        : "audio.wav";
            }
        });
        builder.part("model", "whisper-1");
        builder.part("language", "en");

        Map response = webClient.post()
                .uri("/v1/audio/transcriptions")
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(BodyInserters.fromMultipartData(builder.build()))
                .retrieve()
                .bodyToMono(Map.class)
                .block();

        return response != null ? (String) response.get("text") : "";
    }

    public byte[] synthesize(String text) {
        Map<String, String> requestBody = Map.of(
                "model", "tts-1",
                "input", text,
                "voice", "alloy"
        );

        return webClient.post()
                .uri("/v1/audio/speech")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(requestBody)
                .retrieve()
                .bodyToMono(byte[].class)
                .block();
    }
}