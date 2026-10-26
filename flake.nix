{
  description = "Pomset development environment";

  inputs = {
    # Same channel as the molframe reference environment.
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";
  };

  outputs =
    { nixpkgs, ... }:
    let
      systems = [
        "aarch64-darwin"
        "x86_64-darwin"
        "aarch64-linux"
        "x86_64-linux"
      ];

      forAllSystems = nixpkgs.lib.genAttrs systems;

      # JSON Schema 2020-12 plus OpenAPI 3.1 validation for the contract
      # documents under docs/contracts: the toolchain the documentation
      # validator described in docs/contracts/examples.md runs against.
      # The validator script itself is deliberately not committed; it is a
      # disposable check, not a product dependency.
      docsPython =
        pkgs:
        pkgs.python312.withPackages (ps: [
          ps.jsonschema
          ps.openapi-spec-validator
          ps.pyyaml
          ps.referencing
        ]);

      devShellFor =
        pkgs:
        pkgs.mkShell {
          packages = [
            # TypeScript product, API, CLI, worker and workbench. Node and
            # pnpm come from the same nixpkgs revision, and pnpm is built
            # against that Node, so the shell carries exactly one Node version.
            #
            # pnpm 10 and later re-execute themselves as whatever version a
            # repository's `packageManager` field declares, fetching it when it
            # is not already present. Keep that field equal to the version
            # below, or omit it; a mismatch resolves from the network and fails
            # outright when the shell is used offline.
            pkgs.nodejs
            pkgs.pnpm

            # Python engines: the Triton analyser first, the native adapters
            # later. The repository contract names python 3.12 in
            # docs/delivery/01-feasibility.md; the patch level comes from the
            # pinned nixpkgs revision.
            pkgs.python312
            pkgs.uv

            # The SMT solver the Triton engine queries.
            pkgs.z3

            # Native compilation for the CUDA and OpenMP adapters, which invoke
            # installed vendor toolchains rather than building a compiler.
            pkgs.clang
            pkgs.llvmPackages.openmp
            pkgs.pkg-config

            # Local storage and contract tooling.
            pkgs.sqlite
            pkgs.jq

            # Formatting and linting.
            pkgs.nixfmt
            pkgs.ruff

            # Documentation and contract validation.
            (docsPython pkgs)
          ];

          # Keep uv on the interpreter provided here instead of letting it
          # download and manage a second one.
          UV_PYTHON = "${pkgs.python312}/bin/python3";
          UV_PYTHON_DOWNLOADS = "never";
        };

      # The continuous-integration shell: the same pinned Node, pnpm, Python, uv
      # and solver as the default shell, without the native toolchain. Every
      # product job is CPU-only and needs none of clang, pkg-config or a device;
      # a GPU or native job opts into the default shell instead. A missing device
      # is a documented blocker, so the CPU jobs are the ones that gate a merge.
      ciShellFor =
        pkgs:
        pkgs.mkShell {
          packages = [
            pkgs.nodejs
            pkgs.pnpm
            pkgs.python312
            pkgs.uv
            pkgs.z3
            pkgs.sqlite
            pkgs.jq
            pkgs.git
            pkgs.nixfmt
            pkgs.ruff
            (docsPython pkgs)
          ];

          UV_PYTHON = "${pkgs.python312}/bin/python3";
          UV_PYTHON_DOWNLOADS = "never";
        };
    in
    {
      devShells = forAllSystems (system: {
        default = devShellFor (import nixpkgs { inherit system; });
        ci = ciShellFor (import nixpkgs { inherit system; });
      });
    };
}
