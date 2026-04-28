package com.student.recipe.service.assistant;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.student.recipe.entity.Conversation;
import com.student.recipe.entity.ConversationMessage;
import com.student.recipe.entity.enums.ConversationMessageRole;
import com.student.recipe.repository.ConversationMessageRepository;
import com.student.recipe.repository.ConversationRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ConversationMemoryService {

    private final ConversationRepository conversationRepository;
    private final ConversationMessageRepository messageRepository;

    @Transactional
    public Conversation getOrCreate(Long userId, String conversationKey) {
        return conversationRepository.findByUserIdAndConversationKey(userId, conversationKey)
                .orElseGet(() -> {
                    Conversation c = new Conversation();
                    c.setUserId(userId);
                    c.setConversationKey(conversationKey);
                    return conversationRepository.save(c);
                });
    }

    @Transactional(readOnly = true)
    public List<ConversationMessage> getLastMessages(Long conversationId, int limit) {
        List<ConversationMessage> desc = new ArrayList<>(
                messageRepository.findByConversation_IdOrderByCreatedAtDesc(
                        conversationId, PageRequest.of(0, limit)
                ).getContent()
        );
        Collections.reverse(desc);
        return desc;
    }

    @Transactional
    public void append(Conversation conversation, ConversationMessageRole role, String content) {
        if (conversation == null) return;
        if (content == null) content = "";

        ConversationMessage m = new ConversationMessage();
        m.setConversation(conversation);
        m.setRole(role);
        m.setContent(content);
        messageRepository.save(m);
    }
    @Transactional
    public void setPendingAction(Conversation conversation, String type, String data) {
        conversation.setPendingActionType(type);
        conversation.setPendingActionData(data);
        conversationRepository.save(conversation);
    }

    @Transactional
    public void clearPendingAction(Conversation conversation) {
        conversation.setPendingActionType(null);
        conversation.setPendingActionData(null);
        conversationRepository.save(conversation);
    }
}