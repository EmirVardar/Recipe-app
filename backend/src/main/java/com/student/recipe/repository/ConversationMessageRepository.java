package com.student.recipe.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import com.student.recipe.entity.ConversationMessage;

public interface ConversationMessageRepository extends JpaRepository<ConversationMessage, Long> {
    Page<ConversationMessage> findByConversation_IdOrderByCreatedAtDesc(Long conversationId, Pageable pageable);
}