type SchoolMembership = {
  schoolId: string | null;
  assignedSchools: { schoolId: string }[];
};

// User.role is global, so a role or password change by one school's admin reaches every school the user belongs to.
export function isMultiSchoolUser(user: SchoolMembership): boolean {
  const schoolIds = new Set(user.assignedSchools.map((assignment) => assignment.schoolId));
  if (user.schoolId) schoolIds.add(user.schoolId);
  return schoolIds.size > 1;
}
