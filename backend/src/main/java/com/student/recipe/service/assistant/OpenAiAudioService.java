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

    public record TranscriptionResult(String text, long durationMs) {}

    public record SynthesisResult(byte[] audioBytes, long durationMs) {}

    private final WebClient webClient;

    public OpenAiAudioService(WebClient openAiAudioWebClient) {
        this.webClient = openAiAudioWebClient;
    }

    public TranscriptionResult transcribe(MultipartFile audioFile) throws IOException {
        long startNs = System.nanoTime();
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
        builder.part("language", "tr");

        Map response = webClient.post()
                .uri("/v1/audio/transcriptions")
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(BodyInserters.fromMultipartData(builder.build()))
                .retrieve()
                .bodyToMono(Map.class)
                .block();

        String text = response != null ? (String) response.get("text") : "";
        long durationMs = (System.nanoTime() - startNs) / 1_000_000L;
        return new TranscriptionResult(text, durationMs);
    }

    public SynthesisResult synthesize(String text) {
        long startNs = System.nanoTime();
        Map<String, String> requestBody = Map.of(
                "model", "tts-1",
                "input", text,
                "voice", "alloy"
        );

        byte[] audioBytes = webClient.post()
                .uri("/v1/audio/speech")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(requestBody)
                .retrieve()
                .bodyToMono(byte[].class)
                .block();
        long durationMs = (System.nanoTime() - startNs) / 1_000_000L;
        return new SynthesisResult(audioBytes, durationMs);
    }
}
