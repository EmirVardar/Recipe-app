package com.student.recipe.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.student.recipe.entity.UserNutritionPreference;

public interface UserNutritionPreferenceRepository extends JpaRepository<UserNutritionPreference, Long> {

    Optional<UserNutritionPreference> findByUserId(Long userId);
}
