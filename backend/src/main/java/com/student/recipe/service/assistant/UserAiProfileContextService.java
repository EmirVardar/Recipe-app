package com.student.recipe.service.assistant;

import java.time.LocalDate;
import java.time.Period;
import java.util.Arrays;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import com.student.recipe.dto.assistant.UserAiProfileContextDto;
import com.student.recipe.entity.User;
import com.student.recipe.entity.UserMedical;
import com.student.recipe.entity.UserNutritionPreference;
import com.student.recipe.entity.UserProfile;
import com.student.recipe.repository.UserMedicalRepository;
import com.student.recipe.repository.UserNutritionPreferenceRepository;
import com.student.recipe.repository.UserProfileRepository;
import com.student.recipe.repository.UserRepository;

@Service
public class UserAiProfileContextService {

    private final UserRepository userRepository;
    private final UserProfileRepository userProfileRepository;
    private final UserMedicalRepository userMedicalRepository;
    private final UserNutritionPreferenceRepository userNutritionPreferenceRepository;

    public UserAiProfileContextService(
            UserRepository userRepository,
            UserProfileRepository userProfileRepository,
            UserMedicalRepository userMedicalRepository,
            UserNutritionPreferenceRepository userNutritionPreferenceRepository
    ) {
        this.userRepository = userRepository;
        this.userProfileRepository = userProfileRepository;
        this.userMedicalRepository = userMedicalRepository;
        this.userNutritionPreferenceRepository = userNutritionPreferenceRepository;
    }

    @Transactional(readOnly = true)
    public UserAiProfileContextDto buildContext(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));

        UserProfile profile = userProfileRepository.findByUserId(user.getId()).orElse(null);
        UserMedical medical = userMedicalRepository.findByUserId(user.getId()).orElse(null);
        UserNutritionPreference nutrition = userNutritionPreferenceRepository.findByUserId(user.getId()).orElse(null);

        return new UserAiProfileContextDto(
                calculateAge(profile != null ? profile.getBirthDate() : null),
                profile != null ? profile.getSex() : null,
                profile != null ? profile.getHeightCm() : null,
                profile != null ? profile.getWeightKg() : null,
                profile != null ? profile.getActivityLevel() : null,
                profile != null ? profile.getGoal() : null,
                splitTextList(medical != null ? medical.getChronicConditions() : null),
                splitTextList(medical != null ? medical.getMedications() : null),
                splitTextList(medical != null ? medical.getAllergies() : null),
                splitTextList(medical != null ? medical.getIntolerances() : null),
                nutrition != null ? nutrition.getDietType() : null,
                splitTextList(nutrition != null ? nutrition.getAvoidFoods() : null),
                splitTextList(nutrition != null ? nutrition.getPreferredFoods() : null),
                nutrition != null ? nutrition.getBudgetLevel() : null
        );
    }

    private List<String> splitTextList(String rawValue) {
        if (rawValue == null || rawValue.trim().isEmpty()) {
            return List.of();
        }

        return Arrays.stream(rawValue.split("[,\\n;]"))
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .filter(value -> !value.equalsIgnoreCase("none"))
                .toList();
    }

    private Integer calculateAge(LocalDate birthDate) {
        if (birthDate == null || birthDate.isAfter(LocalDate.now())) {
            return null;
        }
        return Period.between(birthDate, LocalDate.now()).getYears();
    }
}
