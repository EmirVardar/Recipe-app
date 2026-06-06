package com.student.recipe.service;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.student.recipe.dto.food.FoodProductSearchItemDto;

@Service
public class FoodProductQueryService {

    private static final int DEFAULT_LIMIT = 3;
    private static final int MAX_LIMIT = 50;
    private static final Locale TURKISH = Locale.forLanguageTag("tr-TR");
    private static final Map<String, Long> PREFERRED_PRODUCT_IDS = Map.ofEntries(
            Map.entry("yumurta", 1772L),
            Map.entry("haşlanmış yumurta", 1774L),
            Map.entry("domates", 4340L),
            Map.entry("zencefil", 4702L),
            Map.entry("patates", 4037L),
            Map.entry("acı biber", 4418L),
            Map.entry("salatalık", 4404L),
            Map.entry("soğan", 4415L),
            Map.entry("sarımsak", 4406L),
            Map.entry("süt", 2L),
            Map.entry("havuç", 4281L),
            Map.entry("limon", 3792L),
            Map.entry("elma", 3839L),
            Map.entry("muz", 3848L),
            Map.entry("fesleğen", 4400L),
            Map.entry("dana eti", 471L),
            Map.entry("pancar", 4390L),
            Map.entry("dolmalık biber", 4419L),
            Map.entry("siyah nohut", 2035L),
            Map.entry("ekmek", 2210L),
            Map.entry("brokoli", 4264L),
            Map.entry("tereyağı", 4774L),
            Map.entry("lahana", 4393L),
            Map.entry("karnabahar", 4397L),
            Map.entry("peynir", 323L),
            Map.entry("tavuk", 5400L),
            Map.entry("kişniş", 4402L),
            Map.entry("mısır", 4403L),
            Map.entry("hurma", 3827L),
            Map.entry("patlıcan", 4405L),
            Map.entry("balık", 842L),
            Map.entry("un", 2984L),
            Map.entry("üzüm", 3860L),
            Map.entry("barbunya", 2002L),
            Map.entry("kivi", 3862L),
            Map.entry("marul", 4409L),
            Map.entry("kavun", 3850L),
            Map.entry("mantar", 4413L),
            Map.entry("yulaf", 3109L),
            Map.entry("bamya", 4564L),
            Map.entry("portakal", 3795L),
            Map.entry("makarna", 2979L),
            Map.entry("yer fıstığı", 2133L),
            Map.entry("armut", 3877L),
            Map.entry("bezelye", 4417L),
            Map.entry("ananas", 3883L),
            Map.entry("nar", 3890L),
            Map.entry("pirinç", 5406L),
            Map.entry("irmik", 3057L),
            Map.entry("çilek", 3906L),
            Map.entry("şeker", 4876L),
            Map.entry("tatlı patates", 4325L),
            Map.entry("karpuz", 3893L),
            Map.entry("badem", 2107L),
            Map.entry("kaju", 2115L),
            Map.entry("balkabağı", 4313L),
            Map.entry("acı kabak", 4313L),
            Map.entry("yassı pirinç", 5406L),
            Map.entry("tavuk göğsü", 572L),
            Map.entry("tavuk but", 619L),
            Map.entry("hindi göğsü", 723L),
            Map.entry("kıyma", 471L),
            Map.entry("ton balığı", 927L),
            Map.entry("somon", 903L),
            Map.entry("yoğurt", 51L),
            Map.entry("süzme yoğurt", 33L),
            Map.entry("lor peyniri", 367L),
            Map.entry("beyaz peynir", 333L),
            Map.entry("yumurta beyazı", 1790L),
            Map.entry("yulaf ezmesi", 3001L),
            Map.entry("esmer pirinç", 3693L),
            Map.entry("bulgur", 3060L),
            Map.entry("mercimek", 2044L),
            Map.entry("nohut", 2035L),
            Map.entry("ceviz", 2150L),
            Map.entry("fındık", 2121L),
            Map.entry("fıstık ezmesi", 2156L)
    );

    private final JdbcTemplate jdbcTemplate;

    public FoodProductQueryService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<FoodProductSearchItemDto> search(String query, Integer limit) {
        String normalizedQuery = (query == null) ? "" : query.trim();
        if (normalizedQuery.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "q parametresi bos olamaz");
        }

        int safeLimit = normalizeLimit(limit);
        Optional<FoodProductSearchItemDto> preferredMatch = findPreferredMatch(normalizedQuery);
        List<FoodProductSearchItemDto> candidates = runSearchQuery(normalizedQuery, safeLimit + 1);
        return mergePreferredMatch(preferredMatch, candidates, safeLimit);
    }

    public Optional<FoodProductSearchItemDto> findBestMatch(String query) {
        String normalizedQuery = (query == null) ? "" : query.trim();
        if (normalizedQuery.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "q parametresi bos olamaz");
        }

        Optional<FoodProductSearchItemDto> preferredMatch = findPreferredMatch(normalizedQuery);
        if (preferredMatch.isPresent()) {
            return preferredMatch;
        }

        return runSearchQuery(normalizedQuery, 1).stream().findFirst();
    }

    private List<FoodProductSearchItemDto> runSearchQuery(String normalizedQuery, int limit) {
        // Kelimeleri PostgreSQL'in FTS formatına getiriyoruz (örn: "boiled potato" -> "boiled & potato")
        String tsQuery = normalizedQuery.trim().replaceAll("\\s+", " & ");

        return jdbcTemplate.query(
                """
                SELECT
                    results.id,
                    results.fdc_id,
                    results.display_name,
                    results.default_gram_weight,
                    results.piece_gram_weight,
                    results.calories_per_100g,
                    results.protein_per_100g,
                    results.carbs_per_100g,
                    results.fat_per_100g
                FROM (
                    SELECT DISTINCT ON (name)
                        id,
                        fdc_id,
                        name,
                        name_tr,
                        COALESCE(name_tr, name) AS display_name,
                        LOWER(
                            TRIM(
                                regexp_replace(
                                    regexp_replace(COALESCE(name_tr, name), '[[:punct:]]', ' ', 'g'),
                                    '\\s+',
                                    ' ',
                                    'g'
                                )
                            )
                        ) AS normalized_display_name,
                        (
                            SELECT COUNT(*)
                            FROM unnest(
                                regexp_split_to_array(
                                    LOWER(
                                        TRIM(
                                            regexp_replace(
                                                regexp_replace(?, '[[:punct:]]', ' ', 'g'),
                                                '\\s+',
                                                ' ',
                                                'g'
                                            )
                                        )
                                    ),
                                    '\\s+'
                                )
                            ) AS token
                            WHERE token <> ''
                              AND LOWER(
                                    TRIM(
                                        regexp_replace(
                                            regexp_replace(COALESCE(name_tr, name), '[[:punct:]]', ' ', 'g'),
                                            '\\s+',
                                            ' ',
                                            'g'
                                        )
                                    )
                                ) LIKE '%' || token || '%'
                        ) AS matched_token_count,
                        (
                            SELECT COUNT(*)
                            FROM unnest(
                                regexp_split_to_array(
                                    LOWER(
                                        TRIM(
                                            regexp_replace(
                                                regexp_replace(?, '[[:punct:]]', ' ', 'g'),
                                                '\\s+',
                                                ' ',
                                                'g'
                                            )
                                        )
                                    ),
                                    '\\s+'
                                )
                            ) AS token
                            WHERE token <> ''
                        ) AS query_token_count,
                        default_gram_weight,
                        piece_gram_weight,
                        calories_per_100g,
                        protein_per_100g,
                        carbs_per_100g,
                        fat_per_100g,
                        -- 1. Full Text Search Rank
                        GREATEST(
                            ts_rank(to_tsvector('english', name), to_tsquery('english', ?)),
                            ts_rank(to_tsvector('simple', COALESCE(name_tr, '')), to_tsquery('simple', ?))
                        ) AS word_rank,
                        -- 2. Trigram Similarity
                        GREATEST(
                            similarity(name, ?),
                            similarity(COALESCE(name_tr, ''), ?)
                        ) AS sim_score,
                        -- 3. Temel Gıda Önceliği
                        CASE
                            WHEN LOWER(
                                TRIM(
                                    regexp_replace(
                                        regexp_replace(COALESCE(name_tr, name), '[[:punct:]]', ' ', 'g'),
                                        '\\s+',
                                        ' ',
                                        'g'
                                    )
                                )
                            ) = LOWER(
                                TRIM(
                                    regexp_replace(
                                        regexp_replace(?, '[[:punct:]]', ' ', 'g'),
                                        '\\s+',
                                        ' ',
                                        'g'
                                    )
                                )
                            ) THEN 120
                            WHEN to_tsvector(
                                    'simple',
                                    LOWER(
                                        TRIM(
                                            regexp_replace(
                                                regexp_replace(COALESCE(name_tr, name), '[[:punct:]]', ' ', 'g'),
                                                '\\s+',
                                                ' ',
                                                'g'
                                            )
                                        )
                                    )
                                ) @@ websearch_to_tsquery(
                                    'simple',
                                    LOWER(
                                        TRIM(
                                            regexp_replace(
                                                regexp_replace(?, '[[:punct:]]', ' ', 'g'),
                                                '\\s+',
                                                ' ',
                                                'g'
                                            )
                                        )
                                    )
                                ) THEN 80
                            WHEN LOWER(
                                TRIM(
                                    regexp_replace(
                                        regexp_replace(COALESCE(name_tr, name), '[[:punct:]]', ' ', 'g'),
                                        '\\s+',
                                        ' ',
                                        'g'
                                    )
                                )
                            ) LIKE LOWER(
                                TRIM(
                                    regexp_replace(
                                        regexp_replace(?, '[[:punct:]]', ' ', 'g'),
                                        '\\s+',
                                        ' ',
                                        'g'
                                    )
                                )
                            ) || ' %' THEN 60
                            ELSE 0
                        END AS basic_priority,
                        -- 4. Teknik Terim Cezası
                        CASE 
                            WHEN name ILIKE '%NFS%' OR name ILIKE '%specified%' OR name ILIKE '%fat added%' THEN -1
                            ELSE 0
                        END AS noise_penalty,
                        -- 5. Literal temel ürün önceliği
                        CASE
                            WHEN LOWER(COALESCE(name_tr, name)) = LOWER(?) THEN 100
                            WHEN LOWER(COALESCE(name_tr, name)) ~ (
                                '(^|[ ,()/-])' ||
                                regexp_replace(LOWER(?), '([\\[\\](){}.+*?^$|\\\\-])', '\\\\\\1', 'g') ||
                                '([ ,()/-]|$)'
                            ) THEN 70
                            WHEN LOWER(COALESCE(name_tr, name)) LIKE LOWER(? || '%') THEN 45
                            WHEN LOWER(COALESCE(name_tr, name)) LIKE LOWER('% ' || ? || '%') THEN 20
                            ELSE 0
                        END AS literal_priority,
                        -- 6. Hazir / işlenmiş ürün cezasi
                        CASE
                            WHEN LOWER(COALESCE(name_tr, name)) ~
                                '(çorba|sos|likör|çay|salata|kek|meşrubat|içecek|şurup|suyu|kraker|bisküvi|pasta|turta|tatlı|icecek|surup|cake|soup|sauce|liqueur|tea|salad|juice|drink|syrup|cracker|biscuit|pie|dessert)'
                            THEN -60
                            ELSE 0
                        END AS processed_penalty
                    FROM food_products
                    WHERE 
                        to_tsvector('english', name) @@ to_tsquery('english', ?)
                        OR to_tsvector('simple', COALESCE(name_tr, '')) @@ to_tsquery('simple', ?)
                        OR name % ?
                        OR COALESCE(name_tr, '') % ?
                ) results
                ORDER BY
                    (CASE
                        WHEN results.query_token_count > 1 AND results.matched_token_count = results.query_token_count THEN 2
                        WHEN results.query_token_count > 1 AND results.matched_token_count > 0 THEN 1
                        ELSE 0
                    END) DESC,
                    results.matched_token_count DESC,
                    results.literal_priority DESC,
                    (CASE
                        WHEN results.name_tr ILIKE ? THEN 1
                        WHEN results.name ILIKE ? THEN 1
                        WHEN results.name_tr ILIKE (? || '%') THEN 2
                        WHEN results.name_tr ~* ('(^| )' || ? || '( |$)') THEN 3
                        WHEN results.name ILIKE (? || ',%') THEN 4
                        WHEN results.name ILIKE (? || '%') THEN 4
                        ELSE 5
                    END) ASC,
                    (results.processed_penalty + results.noise_penalty) DESC,
                    LENGTH(results.display_name) ASC,
                    (results.word_rank * 2 + results.sim_score + results.basic_priority + results.processed_penalty + results.noise_penalty) DESC
                LIMIT ?
                """,
                foodProductRowMapper(),
                normalizedQuery, // SELECT: matched token count
                normalizedQuery, // SELECT: query token count
                tsQuery,       // SELECT: FTS English
                tsQuery,       // SELECT: FTS Turkish
                normalizedQuery, // SELECT: trigram English
                normalizedQuery, // SELECT: trigram Turkish
                normalizedQuery, // SELECT: normalized exact
                normalizedQuery, // SELECT: all query tokens present
                normalizedQuery, // SELECT: normalized starts with
                normalizedQuery, // SELECT: literal exact
                normalizedQuery, // SELECT: literal token match
                normalizedQuery, // SELECT: literal starts with
                normalizedQuery, // SELECT: literal contains after space
                tsQuery,       // WHERE: FTS English
                tsQuery,       // WHERE: FTS Turkish
                normalizedQuery, // WHERE: trigram English
                normalizedQuery, // WHERE: trigram Turkish
                normalizedQuery, // ORDER: name_tr exact
                normalizedQuery, // ORDER: name exact
                normalizedQuery, // ORDER: name_tr starts with
                normalizedQuery, // ORDER: word boundary
                normalizedQuery, // ORDER: name comma
                normalizedQuery, // ORDER: name starts with
                limit
        );
    }

    private Optional<FoodProductSearchItemDto> findPreferredMatch(String query) {
        Long preferredProductId = PREFERRED_PRODUCT_IDS.get(normalizeQueryKey(query));
        if (preferredProductId == null) {
            return Optional.empty();
        }

        return fetchProductById(preferredProductId);
    }

    private Optional<FoodProductSearchItemDto> fetchProductById(long productId) {
        List<FoodProductSearchItemDto> matches = jdbcTemplate.query(
                """
                SELECT
                    id,
                    fdc_id,
                    COALESCE(name_tr, name) AS display_name,
                    default_gram_weight,
                    piece_gram_weight,
                    calories_per_100g,
                    protein_per_100g,
                    carbs_per_100g,
                    fat_per_100g
                FROM food_products
                WHERE id = ?
                """,
                foodProductRowMapper(),
                productId
        );

        return matches.stream().findFirst();
    }

    private List<FoodProductSearchItemDto> mergePreferredMatch(
            Optional<FoodProductSearchItemDto> preferredMatch,
            List<FoodProductSearchItemDto> candidates,
            int limit
    ) {
        if (preferredMatch.isEmpty()) {
            return candidates.stream().limit(limit).toList();
        }

        List<FoodProductSearchItemDto> merged = new ArrayList<>();
        merged.add(preferredMatch.get());

        for (FoodProductSearchItemDto candidate : candidates) {
            if (candidate.id() == preferredMatch.get().id()) {
                continue;
            }
            merged.add(candidate);
            if (merged.size() >= limit) {
                break;
            }
        }

        return merged;
    }

    private String normalizeQueryKey(String value) {
        return value.trim().toLowerCase(TURKISH);
    }

    private int normalizeLimit(Integer limit) {
        if (limit == null) {
            return DEFAULT_LIMIT;
        }
        if (limit < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "limit 1'den kucuk olamaz");
        }
        if (limit > MAX_LIMIT) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "limit 50'den buyuk olamaz");
        }
        return limit;
    }

    private RowMapper<FoodProductSearchItemDto> foodProductRowMapper() {
        return (resultSet, rowNum) -> mapFoodProduct(resultSet);
    }

    private FoodProductSearchItemDto mapFoodProduct(ResultSet resultSet) throws SQLException {
        return new FoodProductSearchItemDto(
                resultSet.getLong("id"),
                resultSet.getLong("fdc_id"),
                resultSet.getString("display_name"),
                getNullableDouble(resultSet, "default_gram_weight"),
                getNullableDouble(resultSet, "piece_gram_weight"),
                getNullableDouble(resultSet, "calories_per_100g"),
                getNullableDouble(resultSet, "protein_per_100g"),
                getNullableDouble(resultSet, "carbs_per_100g"),
                getNullableDouble(resultSet, "fat_per_100g")
        );
    }

    private Double getNullableDouble(ResultSet resultSet, String columnName) throws SQLException {
        double value = resultSet.getDouble(columnName);
        return resultSet.wasNull() ? null : value;
    }
}
