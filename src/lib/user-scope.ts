type SchoolMembership = {
  schoolId?: string | null;
  homeSchoolId?: string | null;
  assignedSchoolIds?: string[];
  assignedSchools?: { schoolId: string }[];
};

// User.role is global, so a role or password change by one school's admin reaches every school the user belongs to.
export function isMultiSchoolUser(user: { schoolId: string | null; assignedSchools: { schoolId: string }[] }): boolean {
  const schoolIds = new Set(user.assignedSchools.map((assignment) => assignment.schoolId));
  if (user.schoolId) schoolIds.add(user.schoolId);
  return schoolIds.size > 1;
}

export function getUserSchoolIds(user: SchoolMembership): string[] {
  const ids = new Set<string>();
  if (user.schoolId) ids.add(user.schoolId);
  if (user.homeSchoolId) ids.add(user.homeSchoolId);
  if (user.assignedSchoolIds) {
    for (const id of user.assignedSchoolIds) ids.add(id);
  }
  if (user.assignedSchools) {
    for (const assignment of user.assignedSchools) ids.add(assignment.schoolId);
  }
  return Array.from(ids);
}

export function isUserInSchool(user: SchoolMembership, schoolId: string): boolean {
  return getUserSchoolIds(user).includes(schoolId);
}

