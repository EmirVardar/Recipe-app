package com.student.recipe.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.student.recipe.entity.FoodProduct;

public interface FoodProductRepository extends JpaRepository<FoodProduct, Long> {
}
