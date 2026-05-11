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

        // 1) Ses → metin
        String userText = audioService.transcribe(file);

        // 2) Metin → GPT cevap
        AssistantChatResponseDto chatResponse = assistantChatService.chat(
                authentication.getName(), userText
        );

        // 3) Cevap → ses
        byte[] audioBytes = audioService.synthesize(chatResponse.answer());
        String base64Audio = Base64.getEncoder().encodeToString(audioBytes);

        return ResponseEntity.ok(Map.of(
                "transcribedText", userText,
                "answer", chatResponse.answer(),
                "audio", base64Audio
        ));
    }
}
