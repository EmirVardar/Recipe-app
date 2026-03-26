package com.student.recipe.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.student.recipe.entity.Recipe;

public interface RecipeRepository extends JpaRepository<Recipe, Long> {

    @EntityGraph(attributePaths = "recipeNutrition")
    List<Recipe> findAllByOrderByCreatedAtDesc();

    @EntityGraph(attributePaths = "recipeNutrition")
    @Query("""
            select distinct r
            from Recipe r
            left join r.recipeIngredients ri
            left join ri.ingredient i
            where lower(r.title) like lower(concat('%', :query, '%'))
               or lower(i.name) like lower(concat('%', :query, '%'))
            order by r.createdAt desc
            """)
    List<Recipe> searchByTitleOrIngredient(@Param("query") String query);

    Optional<Recipe> findBySpoonacularId(Long spoonacularId);
}
