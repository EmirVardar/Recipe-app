package com.student.recipe.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import com.student.recipe.entity.MealLog;
import com.student.recipe.entity.enums.MealType;

public interface MealLogRepository extends JpaRepository<MealLog, Long> {

    Optional<MealLog> findByUserIdAndLogDateAndMealType(Long userId, LocalDate logDate, MealType mealType);

    @EntityGraph(attributePaths = {"items", "items.foodProduct", "items.recipe"})
    List<MealLog> findAllByUserIdAndLogDateOrderByCreatedAtAsc(Long userId, LocalDate logDate);
}
