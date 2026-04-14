package com.student.recipe.config;

import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

import com.student.recipe.service.FnddsImportService;

@Configuration
public class FnddsBootstrapConfig {

    @Bean
    public ApplicationRunner fnddsBootstrapRunner(
            JdbcTemplate jdbcTemplate,
            FnddsImportService fnddsImportService
    ) {
        return args -> {
            Integer tableExists = jdbcTemplate.queryForObject(
                    """
                    SELECT COUNT(*)
                    FROM information_schema.tables
                    WHERE table_schema = 'public'
                      AND table_name = 'fndds_food_raw'
                    """,
                    Integer.class
            );
            if (tableExists == null || tableExists == 0) {
                return;
            }

            Integer rawCount = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM fndds_food_raw", Integer.class);
            if (rawCount == null || rawCount == 0) {
                return;
            }
            fnddsImportService.importFoodProducts();
        };
    }
}
