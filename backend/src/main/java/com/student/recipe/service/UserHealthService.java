package com.student.recipe.service;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.student.recipe.dto.MedicalResponseDto;
import com.student.recipe.dto.MedicalUpdateRequestDto;
import com.student.recipe.dto.NutritionPreferenceResponseDto;
import com.student.recipe.dto.NutritionPreferenceUpdateRequestDto;
import com.student.recipe.dto.OnboardingStatusResponseDto;
import com.student.recipe.dto.ProfileResponseDto;
import com.student.recipe.dto.ProfileUpdateRequestDto;
import com.student.recipe.entity.User;
import com.student.recipe.entity.UserMedical;
import com.student.recipe.entity.UserNutritionPreference;
import com.student.recipe.entity.UserProfile;
import com.student.recipe.repository.UserMedicalRepository;
import com.student.recipe.repository.UserNutritionPreferenceRepository;
import com.student.recipe.repository.UserProfileRepository;
import com.student.recipe.repository.UserRepository;

@Service
public class UserHealthService {

    private final UserRepository userRepository;
    private final UserProfileRepository userProfileRepository;
    private final UserMedicalRepository userMedicalRepository;
    private final UserNutritionPreferenceRepository userNutritionPreferenceRepository;

    public UserHealthService(
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

    public OnboardingStatusResponseDto getOnboardingStatus(String email) {
        User user = getUserByEmail(email);

        boolean profileCompleted = userProfileRepository.findByUserId(user.getId())
                .map(this::isProfileComplete)
                .orElse(false);

        boolean medicalCompleted = userMedicalRepository.findByUserId(user.getId())
                .map(this::isMedicalComplete)
                .orElse(false);

        boolean nutritionCompleted = userNutritionPreferenceRepository.findByUserId(user.getId())
                .map(this::isNutritionComplete)
                .orElse(false);

        return new OnboardingStatusResponseDto(
                profileCompleted,
                medicalCompleted,
                nutritionCompleted,
                profileCompleted && medicalCompleted && nutritionCompleted
        );
    }

    public ProfileResponseDto upsertProfile(String email, ProfileUpdateRequestDto request) {
        User user = getUserByEmail(email);
        validateProfileRequest(request);

        UserProfile profile = userProfileRepository.findByUserId(user.getId()).orElseGet(UserProfile::new);
        profile.setUser(user);
        profile.setAge(request.age());
        profile.setSex(normalizeNullable(request.sex()));
        profile.setHeightCm(request.heightCm());
        profile.setWeightKg(request.weightKg());
        profile.setActivityLevel(normalizeNullable(request.activityLevel()));
        profile.setGoal(normalizeNullable(request.goal()));

        UserProfile saved = userProfileRepository.save(profile);
        user.setProfile(saved);

        return new ProfileResponseDto(
                saved.getAge(),
                saved.getSex(),
                saved.getHeightCm(),
                saved.getWeightKg(),
                saved.getActivityLevel(),
                saved.getGoal()
        );
    }

    public MedicalResponseDto upsertMedical(String email, MedicalUpdateRequestDto request) {
        User user = getUserByEmail(email);
        validateMedicalRequest(request);

        UserMedical medical = userMedicalRepository.findByUserId(user.getId()).orElseGet(UserMedical::new);
        medical.setUser(user);
        medical.setChronicConditions(normalizeNullable(request.chronicConditions()));
        medical.setMedications(normalizeNullable(request.medications()));
        medical.setAllergies(normalizeNullable(request.allergies()));
        medical.setIntolerances(normalizeNullable(request.intolerances()));

        UserMedical saved = userMedicalRepository.save(medical);
        user.setMedical(saved);

        return new MedicalResponseDto(
                saved.getChronicConditions(),
                saved.getMedications(),
                saved.getAllergies(),
                saved.getIntolerances()
        );
    }

    public NutritionPreferenceResponseDto upsertNutrition(String email, NutritionPreferenceUpdateRequestDto request) {
        User user = getUserByEmail(email);
        validateNutritionRequest(request);

        UserNutritionPreference nutrition = userNutritionPreferenceRepository.findByUserId(user.getId())
                .orElseGet(UserNutritionPreference::new);
        nutrition.setUser(user);
        nutrition.setDietType(normalizeNullable(request.dietType()));
        nutrition.setAvoidFoods(normalizeNullable(request.avoidFoods()));
        nutrition.setPreferredFoods(normalizeNullable(request.preferredFoods()));
        nutrition.setBudgetLevel(normalizeNullable(request.budgetLevel()));

        UserNutritionPreference saved = userNutritionPreferenceRepository.save(nutrition);
        user.setNutritionPreference(saved);

        return new NutritionPreferenceResponseDto(
                saved.getDietType(),
                saved.getAvoidFoods(),
                saved.getPreferredFoods(),
                saved.getBudgetLevel()
        );
    }

    private User getUserByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
    }

    private void validateProfileRequest(ProfileUpdateRequestDto request) {
        if (request.age() == null || request.age() < 1 || request.age() > 120) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Age must be between 1 and 120");
        }
        if (isBlank(request.sex())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Sex is required");
        }
        if (request.heightCm() == null || request.heightCm() <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Height must be greater than 0");
        }
        if (request.weightKg() == null || request.weightKg() <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Weight must be greater than 0");
        }
        if (isBlank(request.goal())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Goal is required");
        }
    }

    private void validateMedicalRequest(MedicalUpdateRequestDto request) {
        if (isBlank(request.chronicConditions())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "chronicConditions is required (use 'none' if there is no condition)");
        }
    }

    private void validateNutritionRequest(NutritionPreferenceUpdateRequestDto request) {
        if (isBlank(request.dietType())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "dietType is required");
        }
    }

    private boolean isProfileComplete(UserProfile profile) {
        return profile.getAge() != null
                && !isBlank(profile.getSex())
                && profile.getHeightCm() != null
                && profile.getHeightCm() > 0
                && profile.getWeightKg() != null
                && profile.getWeightKg() > 0
                && !isBlank(profile.getGoal());
    }

    private boolean isMedicalComplete(UserMedical medical) {
        return !isBlank(medical.getChronicConditions());
    }

    private boolean isNutritionComplete(UserNutritionPreference nutritionPreference) {
        return !isBlank(nutritionPreference.getDietType());
    }

    private String normalizeNullable(String value) {
        if (value == null) {
            return null;
        }

        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
