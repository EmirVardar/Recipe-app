package com.student.recipe.service.assistant;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.student.recipe.dto.AssistantChatResponseDto;

@Service
public class AssistantChatService {

    private static final String SYSTEM_PROMPT = """
            Sen kişiselleştirilmiş bir beslenme asistanısın.
            Yanıtları Türkçe ver.
            Kullanıcıya pratik, uygulanabilir ve güvenli öneriler sun.
            Tıbbi tanı koyma, ilaç dozu önerme.
            Riskli veya klinik aciliyet içeren durumlarda doktora başvurma uyarısı ekle.
            """;

    private final OpenAiService openAiService;

    public AssistantChatService(OpenAiService openAiService) {
        this.openAiService = openAiService;
    }

    public AssistantChatResponseDto chat(String userEmail, String message) {
        if (message == null || message.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "message is required");
        }

        String prompt = "Kullanıcı e-posta: " + userEmail + "\n" +
                "Kullanıcı sorusu: " + message.trim();

        String answer = openAiService.chat(SYSTEM_PROMPT, prompt);

        return new AssistantChatResponseDto(
                answer,
                List.of("Bu yanıt genel bilgilendirme amaçlıdır, tıbbi tanı yerine geçmez."),
                List.of("Önerileri uygularken doktorunun veya diyetisyeninin planını önceliklendir.")
        );
    }
}
