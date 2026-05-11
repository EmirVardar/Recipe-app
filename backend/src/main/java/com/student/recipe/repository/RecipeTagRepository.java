package com.student.recipe.repository;

import com.student.recipe.entity.RecipeTag;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface RecipeTagRepository extends JpaRepository<RecipeTag, Long> {

    @Query("""
            select distinct rt.tagValue
            from RecipeTag rt
            where rt.tagValueTr is null
            order by rt.tagValue asc
            """)
    List<String> findDistinctUntranslatedTagValues();

    @Modifying
    @Query("""
            update RecipeTag rt
            set rt.tagValueTr = :translatedValue
            where rt.tagValue = :originalValue
            """)
    int updateTagValueTrByTagValue(
            @Param("originalValue") String originalValue,
            @Param("translatedValue") String translatedValue
    );
}
