package com.student.recipe.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import com.student.recipe.entity.UserFridgeItem;

public interface UserFridgeItemRepository extends JpaRepository<UserFridgeItem, Long> {

    @EntityGraph(attributePaths = {"foodProduct"})
    List<UserFridgeItem> findAllByUserIdOrderByUpdatedAtDesc(Long userId);

    @EntityGraph(attributePaths = {"foodProduct", "user"})
    Optional<UserFridgeItem> findById(Long id);
}
