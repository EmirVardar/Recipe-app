package com.student.recipe.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.student.recipe.entity.Conversation;

public interface ConversationRepository extends JpaRepository<Conversation, Long> {
    Optional<Conversation> findByUserIdAndConversationKey(Long userId, String conversationKey);
}