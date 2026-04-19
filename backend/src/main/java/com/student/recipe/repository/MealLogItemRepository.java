package com.student.recipe.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.student.recipe.entity.MealLogItem;

public interface MealLogItemRepository extends JpaRepository<MealLogItem, Long> {

    long countByMealLogId(Long mealLogId);
}
