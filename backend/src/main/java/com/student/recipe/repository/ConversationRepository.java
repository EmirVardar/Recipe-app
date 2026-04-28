package com.student.recipe.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.student.recipe.entity.Conversation;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ConversationRepository extends JpaRepository<Conversation, Long> {
    Optional<Conversation> findByUserIdAndConversationKey(Long userId, String conversationKey);
    @Modifying
    @Query("UPDATE Conversation c SET c.pendingActionType = :type, c.pendingActionData = :data WHERE c.id = :id")
    void updatePendingAction(@Param("id") Long id, @Param("type") String type, @Param("data") String data);
}
