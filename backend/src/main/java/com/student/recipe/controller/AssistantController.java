package com.student.recipe.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.student.recipe.dto.AssistantChatRequestDto;
import com.student.recipe.dto.AssistantChatResponseDto;
import com.student.recipe.service.assistant.AssistantChatService;

@RestController
@RequestMapping("/api/assistant")
public class AssistantController {

    private final AssistantChatService assistantChatService;

    public AssistantController(AssistantChatService assistantChatService) {
        this.assistantChatService = assistantChatService;
    }

    @PostMapping("/chat")
    public ResponseEntity<AssistantChatResponseDto> chat(
            Authentication authentication,
            @RequestBody AssistantChatRequestDto request
    ) {
        return ResponseEntity.ok(assistantChatService.chat(authentication.getName(), request.message()));
    }
}
