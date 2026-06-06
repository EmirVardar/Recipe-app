package com.student.recipe.controller;

import com.student.recipe.dto.assistant.AssistantChatResponseDto;
import com.student.recipe.service.assistant.AssistantChatService;
import com.student.recipe.service.assistant.OpenAiAudioService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Base64;
import java.util.Map;

@RestController
@RequestMapping("/api/assistant")
public class VoiceController {

    private final OpenAiAudioService audioService;
    private final AssistantChatService assistantChatService;

    public VoiceController(
            OpenAiAudioService audioService,
            AssistantChatService assistantChatService
    ) {
        this.audioService = audioService;
        this.assistantChatService = assistantChatService;
    }

    @PostMapping(value = "/voice", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> askWithVoice(
            Authentication authentication,
            @RequestParam("file") MultipartFile file
    ) throws IOException {
        long totalStartNs = System.nanoTime();

        // 1) Ses → metin
        OpenAiAudioService.TranscriptionResult transcriptionResult = audioService.transcribe(file);
        String userText = transcriptionResult.text();

        // 2) Metin → GPT cevap
        long assistantStartNs = System.nanoTime();
        AssistantChatResponseDto chatResponse = assistantChatService.chat(
                authentication.getName(), userText
        );
        long assistantProcessingMs = (System.nanoTime() - assistantStartNs) / 1_000_000L;

        // 3) Cevap → ses
        OpenAiAudioService.SynthesisResult synthesisResult = audioService.synthesize(chatResponse.answer());
        String base64Audio = Base64.getEncoder().encodeToString(synthesisResult.audioBytes());

        Map<String, Object> responseBody = new java.util.HashMap<>();
        responseBody.put("transcribedText", userText);
        responseBody.put("answer", chatResponse.answer());
        responseBody.put("audio", base64Audio);
        if (chatResponse.quickReplies() != null) {
            responseBody.put("quickReplies", chatResponse.quickReplies());
        }
        System.out.println(
                "PERF_VOICE_SUMMARY " +
                "whisperMs=" + transcriptionResult.durationMs() +
                " assistantProcessingMs=" + assistantProcessingMs +
                " ttsMs=" + synthesisResult.durationMs() +
                " totalMs=" + ((System.nanoTime() - totalStartNs) / 1_000_000L)
        );
        return ResponseEntity.ok(responseBody);
    }
}
