interface SignupFieldsProps {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  setFirstName: (v: string) => void;
  setLastName: (v: string) => void;
  setPhoneNumber: (v: string) => void;
}

export function SignupFields({
  firstName,
  lastName,
  phoneNumber,
  setFirstName,
  setLastName,
  setPhoneNumber,
}: SignupFieldsProps) {
  return (
    <>
      <input
        type="text"
        placeholder="First name"
        className="auth-input"
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
        required
      />

      <input
        type="text"
        placeholder="Last name"
        className="auth-input"
        value={lastName}
        onChange={(e) => setLastName(e.target.value)}
        required
      />

      <input
        type="tel"
        placeholder="Phone number"
        className="auth-input"
        value={phoneNumber}
        onChange={(e) => setPhoneNumber(e.target.value)}
        required
      />
    </>
  );
}
