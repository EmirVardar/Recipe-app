package com.student.recipe.repository;

import com.student.recipe.entity.FoodProduct;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface FoodProductRepository extends JpaRepository<FoodProduct, Long> {

    @Query("SELECT f FROM FoodProduct f WHERE f.nameTr IS NULL")
    Page<FoodProduct> findAllWithoutTurkishName(Pageable pageable);
}