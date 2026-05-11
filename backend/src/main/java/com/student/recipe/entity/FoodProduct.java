package com.student.recipe.entity;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "food_products")
public class FoodProduct {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "fdc_id", nullable = false, unique = true)
    private Long fdcId;

    @Column(nullable = false, length = 1000)
    private String name;

    @Column(name = "name_tr", length = 1000)
    private String nameTr;

    @Column(name = "default_gram_weight", nullable = false)
    private Double defaultGramWeight;

    @Column(name = "piece_gram_weight")
    private Double pieceGramWeight;

    @Column(name = "calories_per_100g")
    private Double caloriesPer100g;

    @Column(name = "protein_per_100g")
    private Double proteinPer100g;

    @Column(name = "carbs_per_100g")
    private Double carbsPer100g;

    @Column(name = "fat_per_100g")
    private Double fatPer100g;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
